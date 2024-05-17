export type TDestination = {
  account: TWalletType;
  wallet: string;
};

export type TTransaction<M> = {
  amount: bigint;
  balancesBefore: { fromWallet: TWallet; toWallet: TWallet };
  fromAcc: TDestination;
  id: number;
  metadata?: M;
  timestamp: number;
  toAcc: TDestination;
};

export type TTransactionExternal<M> = Omit<
  TTransaction<M>,
  "amount" | "balancesBefore"
> & {
  amount: number;
  balancesBefore: { fromWallet: TWalletExternal; toWallet: TWalletExternal };
};

export type TWalletType = "available" | "hold";

export type TWallet = {
  [type in TWalletType]: bigint;
};

export type TWalletExternal = {
  [wallet: string]: number;
};

const serializeBigint = (n: bigint): number => {
  return Number(n / 1000n);
};

const deserializeBigint = (n: number): bigint => {
  return BigInt(n) * 1000n;
};

export class Ledger<M extends object> {
  private seriaLizeTx = (tx: TTransaction<M>): TTransactionExternal<M> => {
    return {
      ...tx,
      amount: serializeBigint(tx.amount),
      balancesBefore: {
        fromWallet: {
          available: serializeBigint(tx.balancesBefore.fromWallet.available),
          hold: serializeBigint(tx.balancesBefore.fromWallet.hold),
        },
        toWallet: {
          available: serializeBigint(tx.balancesBefore.toWallet.available),
          hold: serializeBigint(tx.balancesBefore.toWallet.hold),
        },
      },
    };
  };
  private txs: TTransaction<M>[] = [];
  private wallets: { [account: string]: TWallet } = {};

  public addTx(
    fromWallet: string,
    fromAcc: TWalletType,
    toWallet: string,
    toAcc: TWalletType,
    amount: number,
    other?: { metadata?: M },
  ): number {
    if (!this.wallets[fromWallet]) {
      throw new Error("From wallet does not exist");
    }
    if (this.wallets[fromWallet][fromAcc] === undefined) {
      throw new Error("From account does not exist");
    }
    if (!this.wallets[toWallet]) {
      throw new Error("To wallet does not exist");
    }
    if (this.wallets[toWallet][toAcc] === undefined) {
      throw new Error("To account does not exist");
    }
    if (amount % 1 != 0) {
      throw new Error("Amount is not an integer");
    }
    if (amount < 0) {
      throw new Error("Amount must be positive");
    }

    const amountB = deserializeBigint(amount);
    const id = this.txs.length;

    const newTx: TTransaction<M> = {
      amount: amountB,
      balancesBefore: {
        fromWallet: { ...this.wallets[fromWallet] },
        toWallet: { ...this.wallets[toWallet] },
      },
      fromAcc: { account: fromAcc, wallet: fromWallet },
      id,
      toAcc: { account: toAcc, wallet: toWallet },
      ...(other?.metadata ? { metadata: other.metadata } : {}),
      timestamp: Date.now(),
    };

    this.wallets[fromWallet][fromAcc] -= amountB;
    this.wallets[toWallet][toAcc] += amountB;

    this.txs.push(newTx);

    return id;
  }

  public addWallet(wallet: string): void {
    if (this.wallets[wallet]) {
      throw new Error("Wallet already exists");
    }

    this.wallets[wallet] = { available: 0n, hold: 0n };
  }

  public checkIntegrety(): true {
    const newWallets = { ...this.wallets };
    for (const wallet in newWallets) {
      newWallets[wallet] = { available: 0n, hold: 0n };
    }

    // Check that the transactions are valid
    for (const tx of this.txs) {
      const { balancesBefore: bb } = tx;

      for (const key of ["available", "hold"]) {
        if (bb.fromWallet[key] !== newWallets[tx.fromAcc.wallet][key]) {
          throw new Error(`balancesBefore "from" mismatch for ${tx.id}`);
        }

        if (bb.toWallet[key] !== newWallets[tx.toAcc.wallet][key]) {
          throw new Error(`balancesBefore "to" mismatch for ${tx.id}`);
        }
      }

      newWallets[tx.fromAcc.wallet][tx.fromAcc.account] -= tx.amount;
      newWallets[tx.toAcc.wallet][tx.toAcc.account] += tx.amount;
    }

    // Check that the wallet balances are valid
    for (const wallet in this.wallets) {
      for (const key of ["available", "hold"]) {
        if (newWallets[wallet][key] !== this.wallets[wallet][key]) {
          throw new Error(`wallet mismatch for ${wallet} ${key}`);
        }
      }
    }

    // Check if summary balances is zero
    let sum = 0n;
    for (const wallet in newWallets) {
      for (const key of ["available", "hold"]) {
        sum += newWallets[wallet][key];
      }
    }
    if (sum !== 0n) {
      throw new Error("Summary balances is not zero");
    }

    return true;
  }

  public getTransaction(ledgerID: number): TTransactionExternal<M> {
    const t = this.txs[ledgerID];
    if (!t) {
      throw new Error("Transaction does not exist");
    }
    return this.seriaLizeTx(this.txs[ledgerID]);
  }

  public getTransactions(): TTransactionExternal<M>[] {
    return this.txs.map(this.seriaLizeTx);
  }

  public getWalletBalance(wallet: string): TWalletExternal {
    if (!this.wallets[wallet]) {
      throw new Error("Wallet does not exist");
    }

    const w = this.wallets[wallet];
    return {
      available: serializeBigint(w.available),
      hold: serializeBigint(w.hold),
    };
  }

  public jsonDump(): string {
    const obj = {
      data: { txs: this.txs, wallets: this.wallets },
      metadata: { version: 1 },
    };
    return JSON.stringify(obj, (_, v) =>
      typeof v === "bigint" ? v.toString() : v,
    );
  }

  public jsonLoad(str: string): void {
    const obj = JSON.parse(str, (_, v) => {
      if (typeof v === "string") {
        try {
          return BigInt(v);
        } catch (e) {
          return v;
        }
      }

      return v;
    });

    // migrate data if needed

    this.txs = obj.data.txs;
    this.wallets = obj.data.wallets;
  }
}
