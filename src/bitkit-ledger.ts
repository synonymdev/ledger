import {
  TChannel,
  TChannelManagerClaim,
  TChannelManagerPaymentSent,
  TChannelMonitor,
} from "@synonymdev/react-native-ldk";
import { IFormattedTransaction, IFormattedTransactions } from "beignet";

import { Ledger, TTransactionExternal, TWalletType } from "./ledger";

type TOnchainMetadata = {
  txid: string;
  type: "onchain";
};

type TLightningMetadata = {
  payment_hash: string;
  type: "lightning";
};

type TLightningChannelMetadata = {
  channel_id: string;
  type: "lightningChannel";
};

type TMetadata = (
  | TLightningChannelMetadata
  | TLightningMetadata
  | TOnchainMetadata
) & { desc?: string };

type TWalletLocalName = "lightning" | "onchain";
type TWalletRemoteName = "lightning_remote" | "onchain_remote";
type TWalletName = TWalletLocalName | TWalletRemoteName;

export type TBitkitTransaction = TTransactionExternal<TMetadata>;

export type TChannelTimestamp = TChannel & { timestamp: number };

export type TChannelMonitorTimestamp = TChannelMonitor & { timestamp: number };

export const satsToBtc = (sats: number) => {
  return sats / 10e7;
};

export const btcToSats = (btc: number) => {
  return Math.round(btc * 10e7);
};

export class BitkitLedger {
  public ledger: Ledger<TMetadata>;

  constructor() {
    this.ledger = new Ledger<TMetadata>();
  }

  public checkOnchainBalance(beignetBalance: number): boolean {
    return beignetBalance === this.ledger.getWalletBalance("onchain").available;
  }

  public confirmTransaction(ledgerID: number) {
    const t = this.ledger.getTransaction(ledgerID);
    // check if it is a Hold transaction
    if (t.toAcc.account !== "hold") {
      throw new Error("only hold tx can be confirmed");
    }

    const metadata = t.metadata;
    let toWallet: TWalletName;

    if (metadata.type === "onchain") {
      toWallet = t.fromAcc.wallet === "onchain" ? "onchain_remote" : "onchain";
    } else {
      toWallet =
        t.fromAcc.wallet === "lightning" ? "lightning_remote" : "lightning";
    }

    metadata.desc = "tx get confirmed";

    return this.ledger.addTx(
      t.toAcc.wallet,
      t.toAcc.account,
      toWallet,
      "available",
      t.amount,
      { metadata },
    );
  }

  public getOncainTx(txid: string) {
    return this.ledger.getTransactions().find((tx) => {
      return tx.metadata.type === "onchain" && tx.metadata.txid === txid;
    });
  }

  public handleLNChannelClose(ch: TChannelMonitor | TChannelMonitorTimestamp) {
    // we need to find the channel open tx
    const chls = this.ledger
      .getTransactions()
      .filter(
        (t) =>
          t.metadata.type === "lightningChannel" &&
          t.metadata.channel_id === ch.channel_id,
      );

    if (chls.length === 0) {
      throw new Error("channel open tx not found");
    }

    // check if closing tx already exsists
    if (chls[chls.length - 1].toAcc.wallet === "lightning_remote") {
      return;
    }

    const amount = ch.claimable_balances.reduce((acc, cb) => {
      return acc + cb.amount_satoshis;
    }, 0);

    this.lightningChannelClose(amount, true, {
      channel_id: ch.channel_id,
    });
  }

  public handleLNChannelOpen(ch: TChannel | TChannelTimestamp) {
    const chls = this.ledger
      .getTransactions()
      .filter((t) => t.metadata.type === "lightningChannel");

    const amount = ch.balance_sat; // can be 0
    const found = chls.filter(
      (t) =>
        t.metadata.type === "lightningChannel" &&
        t.metadata.channel_id === ch.channel_id,
    );
    const ready = ch.is_channel_ready;

    if (found.length === 0) {
      // no records found, add it
      this.lightningChannelOpen(amount, ready, {
        channel_id: ch.channel_id,
      });
    } else if (found.length === 1) {
      // one record found, check if it is successfull
      const f = found[0];
      // if it is a hold tx, confirm it
      if (f.toAcc.account === "hold" && ready) {
        this.confirmTransaction(f.id);
      }
    } else if (found.length === 2) {
      // two records. One should be hold, the other should be confirmation
      const [hold, conf] = found;
      if (hold.toAcc.account !== "hold") {
        throw new Error("2 tx, first should be hold");
      }
      if (conf.toAcc.account !== "available") {
        throw new Error("2 tx, second should be confirmation");
      }
    } else {
      throw new Error("more than 2 tx found");
    }
  }

  public handleLNTx(tx: TChannelManagerClaim | TChannelManagerPaymentSent) {
    const ltsx = this.ledger
      .getTransactions()
      .filter((t) => t.metadata.type === "lightning");

    // ignore failed payments
    if (tx.state === "failed") {
      return;
    }

    if (!tx.amount_sat) {
      throw new Error("amount_sat is missing");
    }

    const amount = tx.amount_sat + ("fee_paid_sat" in tx ? tx.fee_paid_sat : 0);
    const txType = "fee_paid_sat" in tx ? "sent" : "received";
    const confirmed = tx.state === "successful";
    const found = ltsx.filter(
      (t) =>
        t.metadata.type === "lightning" &&
        t.metadata.payment_hash === tx.payment_hash,
    );

    if (found.length === 0) {
      // no records found, add it

      if (txType === "sent") {
        this.lightningSend(amount, confirmed, {
          payment_hash: tx.payment_hash,
        });
      } else {
        this.lightningReceive(amount, confirmed, {
          payment_hash: tx.payment_hash,
        });
      }
    } else if (found.length === 1) {
      // one record found, check if it is successfull
      const f = found[0];
      // if it is a hold tx, confirm it
      if (f.toAcc.account === "hold" && confirmed) {
        this.confirmTransaction(f.id);
      }
    } else if (found.length === 2) {
      // two records. One should be hold, the other should be confirmation
      const [hold, conf] = found;
      if (hold.toAcc.account !== "hold") {
        throw new Error("2 tx, first should be hold");
      }
      if (conf.toAcc.account !== "available") {
        throw new Error("2 tx, second should be confirmation");
      }
    } else {
      throw new Error("more than 2 tx found");
    }
  }

  public handleOnchainTx(tx: IFormattedTransaction) {
    const ltsx = this.ledger
      .getTransactions()
      .filter((t) => t.metadata.type === "onchain");

    const confirmed = tx.confirmTimestamp > 0;
    const found = ltsx.filter(
      (t) => t.metadata.type === "onchain" && t.metadata.txid === tx.txid,
    );

    if (found.length === 0) {
      // no records found, add it
      const amount = btcToSats(Math.abs(tx.value));
      if (tx.type === "sent") {
        this.onchainSend(amount, confirmed, { txid: tx.txid });
      } else {
        this.onchainReceive(amount, confirmed, { txid: tx.txid });
      }
    } else if (found.length === 1) {
      // one record found, check if it is confirmed
      const f = found[0];
      // if it is a hold tx, confirm it
      if (f.toAcc.account === "hold" && confirmed) {
        this.confirmTransaction(f.id);
      }
    } else if (found.length === 2) {
      // two records. One should be hold, the other should be confirmation
      const [hold, conf] = found;
      if (hold.toAcc.account !== "hold") {
        throw new Error("2 tx, first should be hold");
      }
      if (conf.toAcc.account !== "available") {
        throw new Error("2 tx, second should be confirmation");
      }
    } else {
      throw new Error("more than 2 tx found");
    }
  }

  public initEmptyLedger() {
    this.ledger.addWallet("onchain");
    this.ledger.addWallet("onchain_remote");
    this.ledger.addWallet("lightning");
    this.ledger.addWallet("lightning_remote");
  }

  public lightningChannelClose(
    amount: number,
    confirmed: boolean,
    metadata: Omit<TLightningChannelMetadata, "type">,
  ): number {
    const meta: TLightningChannelMetadata = {
      ...metadata,
      type: "lightningChannel",
    };

    const [toWallet, toAcc] = confirmed
      ? ["lightning_remote", "available" as TWalletType]
      : ["lightning", "hold" as TWalletType];

    return this.ledger.addTx(
      "lightning",
      "available",
      toWallet,
      toAcc,
      amount,
      {
        metadata: meta,
      },
    );
  }

  public lightningChannelOpen(
    amount: number,
    confirmed: boolean,
    metadata: Omit<TLightningChannelMetadata, "type">,
  ): number {
    const meta: TLightningChannelMetadata = {
      ...metadata,
      type: "lightningChannel",
    };

    const [toWallet, toAcc] = confirmed
      ? ["lightning", "available" as TWalletType]
      : ["lightning", "hold" as TWalletType];

    return this.ledger.addTx(
      "lightning_remote",
      "available",
      toWallet,
      toAcc,
      amount,
      {
        metadata: meta,
      },
    );
  }

  public lightningReceive(
    amount: number,
    confirmed: boolean,
    metadata: Omit<TLightningMetadata, "type">,
  ): number {
    const meta: TLightningMetadata = { ...metadata, type: "lightning" };

    const [toWallet, toAcc] = confirmed
      ? ["lightning", "available" as TWalletType]
      : ["lightning", "hold" as TWalletType];

    return this.ledger.addTx(
      "lightning_remote",
      "available",
      toWallet,
      toAcc,
      amount,
      {
        metadata: meta,
      },
    );
  }

  public lightningSend(
    amount: number,
    confirmed: boolean,
    metadata: Omit<TLightningMetadata, "type">,
  ): number {
    const meta: TLightningMetadata = { ...metadata, type: "lightning" };

    const [toWallet, toAcc] = confirmed
      ? ["lightning_remote", "available" as TWalletType]
      : ["lightning", "hold" as TWalletType];

    return this.ledger.addTx(
      "lightning",
      "available",
      toWallet,
      toAcc,
      amount,
      {
        metadata: meta,
      },
    );
  }

  public onchainReceive(
    amount: number,
    confirmed: boolean,
    metadata: Omit<TOnchainMetadata, "type">,
  ): number {
    const meta: TOnchainMetadata = { ...metadata, type: "onchain" };

    const [toWallet, toAcc] = confirmed
      ? ["onchain", "available" as TWalletType]
      : ["onchain", "hold" as TWalletType];

    return this.ledger.addTx(
      "onchain_remote",
      "available",
      toWallet,
      toAcc,
      amount,
      {
        metadata: meta,
      },
    );
  }

  public onchainSend(
    amount: number,
    confirmed: boolean,
    metadata: Omit<TOnchainMetadata, "type">,
  ): number {
    const meta: TOnchainMetadata = { ...metadata, type: "onchain" };

    const [toWallet, toAcc] = confirmed
      ? ["onchain_remote", "available" as TWalletType]
      : ["onchain", "hold" as TWalletType];

    return this.ledger.addTx("onchain", "available", toWallet, toAcc, amount, {
      metadata: meta,
    });
  }

  public revertByLedgerID(ledgerID: number) {
    const t = this.ledger.getTransaction(ledgerID);
    // check if it is a Hold transaction
    if (t.toAcc.account !== "hold") {
      throw new Error("only hold tx can be reverted");
    }

    const metadata = t.metadata;
    metadata.desc = "tx get reverted";

    return this.ledger.addTx(
      t.toAcc.wallet,
      t.toAcc.account,
      t.fromAcc.wallet,
      t.fromAcc.account,
      t.amount,
      { metadata },
    );
  }

  public syncHistory({
    lnChannelClose,
    lnChannelOpen,
    lnClaim,
    lnSent,
    onchain,
  }: {
    lnChannelClose: TChannelMonitorTimestamp[];
    lnChannelOpen: TChannelTimestamp[];
    lnClaim: TChannelManagerClaim[];
    lnSent: TChannelManagerPaymentSent[];
    onchain: IFormattedTransactions;
  }) {
    const txs = [
      ...lnChannelClose,
      ...lnChannelOpen,
      ...lnClaim,
      ...lnSent,
      ...Object.values(onchain),
    ].sort((a, b) => {
      const at = "unix_timestamp" in a ? a.unix_timestamp * 1000 : a.timestamp;
      const bt = "unix_timestamp" in b ? b.unix_timestamp * 1000 : b.timestamp;

      return at - bt;
    });

    for (const t of txs) {
      if ("balance_sat" in t) {
        // channel open
        this.handleLNChannelOpen(t);
      } else if ("funding_txo_txid" in t) {
        // channel close
        this.handleLNChannelClose(t);
      } else if ("timestamp" in t) {
        // onchain
        this.handleOnchainTx(t);
      } else {
        // LN
        this.handleLNTx(t);
      }
    }
  }
}
