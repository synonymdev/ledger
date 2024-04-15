import {
  TChannelManagerClaim,
  TChannelManagerPaymentSent,
} from "@synonymdev/react-native-ldk";
import { IFormattedTransactions } from "beignet";

import { Ledger } from "../src/";
import { BitkitLedger, TChannelTimestamp } from "../src/bitkit-ledger";

describe("Ledger", () => {
  it("works", () => {
    const l = new Ledger();

    l.addWallet("alice");
    l.addWallet("bob");

    expect(l.getWalletBalance("alice")).toEqual({ available: 0, hold: 0 });
    expect(l.getWalletBalance("bob")).toEqual({ available: 0, hold: 0 });

    l.addTx("alice", "available", "bob", "available", 100);
    expect(l.getWalletBalance("alice")).toEqual({ available: -100, hold: 0 });
    expect(l.getWalletBalance("bob")).toEqual({ available: 100, hold: 0 });

    expect(l.getTransactions()[0]).toEqual(
      expect.objectContaining({
        amount: 100,
        balancesBefore: {
          fromWallet: { available: 0, hold: 0 },
          toWallet: { available: 0, hold: 0 },
        },
        fromAcc: { account: "available", wallet: "alice" },
        id: 0,
        toAcc: { account: "available", wallet: "bob" },
      }),
    );

    l.addTx("alice", "hold", "bob", "hold", 100, { metadata: { txid: 1 } });
    expect(l.getWalletBalance("alice")).toEqual({
      available: -100,
      hold: -100,
    });
    expect(l.getWalletBalance("bob")).toEqual({ available: 100, hold: 100 });

    expect(l.getTransactions()[1]).toEqual(
      expect.objectContaining({
        amount: 100,
        balancesBefore: {
          fromWallet: { available: -100, hold: 0 },
          toWallet: { available: 100, hold: 0 },
        },
        fromAcc: { account: "hold", wallet: "alice" },
        id: 1,
        metadata: { txid: 1 },
        toAcc: { account: "hold", wallet: "bob" },
      }),
    );

    expect(l.checkIntegrety()).toBe(true);

    const json = l.jsonDump();
    const l2 = new Ledger();
    l2.jsonLoad(json);

    expect(l2.getWalletBalance("alice")).toEqual({
      available: -100,
      hold: -100,
    });

    expect(l2.getTransactions()[1]).toEqual(
      expect.objectContaining({
        amount: 100,
        balancesBefore: {
          fromWallet: { available: -100, hold: 0 },
          toWallet: { available: 100, hold: 0 },
        },
        fromAcc: { account: "hold", wallet: "alice" },
        id: 1,
        metadata: { txid: 1 },
        toAcc: { account: "hold", wallet: "bob" },
      }),
    );
  });
});

describe("BitkitLedger", () => {
  it("works", () => {
    const l = new BitkitLedger();

    l.initEmptyLedger();

    expect(l.ledger.getWalletBalance("onchain")).toEqual({
      available: 0,
      hold: 0,
    });
    expect(l.ledger.getWalletBalance("onchain_remote")).toEqual({
      available: 0,
      hold: 0,
    });
    expect(l.ledger.getWalletBalance("lightning")).toEqual({
      available: 0,
      hold: 0,
    });
    expect(l.ledger.getWalletBalance("lightning_remote")).toEqual({
      available: 0,
      hold: 0,
    });

    const id = l.onchainSend(100, false, { txid: "xxx" });

    expect(l.ledger.getWalletBalance("onchain")).toEqual({
      available: -100,
      hold: 100,
    });

    l.confirmTransaction(id);

    expect(l.ledger.getWalletBalance("onchain")).toEqual({
      available: -100,
      hold: 0,
    });
    expect(l.ledger.getWalletBalance("onchain_remote")).toEqual({
      available: 100,
      hold: 0,
    });

    expect(l.ledger.checkIntegrety()).toBe(true);
  });

  it("can sync onchain", () => {
    const l = new BitkitLedger();
    l.initEmptyLedger();

    // eslint-disable-block
    const onchain = {
      "0293a04a74de22d4acbac9b49db5e179e747b3702c0b21fa9ad062f5728751d9": {
        // #3
        address: "bcrt1q2f9c2c55rkz9lshspln260w2sja7zt46y3ymrq",
        confirmTimestamp: 1708616011000,
        exists: true,
        fee: 0.00000356,
        height: 20501,
        matchedInputValue: 0.003,
        matchedOutputValue: 0,
        messages: [],
        rbf: false,
        satsPerByte: 2,
        scriptHash:
          "ad84bc285fa52dcfb75d97ad35ae6ba8f39cc0d2b4def21cfd3a097afc9f531e",
        timestamp: 1708615997564,
        totalInputValue: 0.003,
        totalOutputValue: 0.00299644,
        txid: "0293a04a74de22d4acbac9b49db5e179e747b3702c0b21fa9ad062f5728751d9",
        type: "sent",
        value: -0.003,
        vin: [[Object], [Object]],
        vsize: 178,
      },
      "3e729cd358350fd2efcf8a486374a2ff83ebc1a8942d1e1f2449440d007e1464": {
        address: "bcrt1qyzuqvk3e7tszrjcvqhm9qpvd2wyd4f0njuxgj9",
        confirmTimestamp: 1708616047000,
        exists: true,
        fee: 0.00423337,
        height: 20502,
        matchedInputValue: 0,
        matchedOutputValue: 0.004,
        messages: [],
        rbf: false,
        satsPerByte: 3002,
        scriptHash:
          "e7566598328396b2baa5397bde1a8bb59b07e9da7b1ea46ed9a131c148ab4011",
        timestamp: 1708616044197,
        totalInputValue: 0.04453039,
        totalOutputValue: 0.04029702,
        txid: "3e729cd358350fd2efcf8a486374a2ff83ebc1a8942d1e1f2449440d007e1464",
        type: "received",
        value: 0.004,
        vin: [[Object]],
        vsize: 141,
      },
      "3829b38feb4650b31141f65df6d8b50f885ba2e3906ac218b29a7e52f54392a7": {
        // #1
        address: "bcrt1qwm6e8uvq2qlrm4qtjsxk5dry76udmz6dp2sqvl",
        confirmTimestamp: 1708615632000,
        exists: true,
        fee: 0.00423333,
        height: 20498,
        matchedInputValue: 0,
        matchedOutputValue: 0.001,
        messages: [],
        rbf: false,
        satsPerByte: 3002,
        scriptHash:
          "27f371f6fb8dea770ef6377fc4b8563216b4deb59e0b3c066de1abd1e4b837a8",
        timestamp: 1708615630008,
        totalInputValue: 0.21602513,
        totalOutputValue: 0.2117918,
        txid: "3829b38feb4650b31141f65df6d8b50f885ba2e3906ac218b29a7e52f54392a7",
        type: "received",
        value: 0.001,
        vin: [[Object]],
        vsize: 141,
      },
      cf72a075b6d3ac209af7f16ac160c007f9daedc5b49b7bc025d5fb62b9b541bf: {
        // #2
        address: "bcrt1q2f9c2c55rkz9lshspln260w2sja7zt46y3ymrq",
        confirmTimestamp: 1708615964000,
        exists: true,
        fee: 0.00423337,
        height: 20500,
        matchedInputValue: 0,
        matchedOutputValue: 0.002,
        messages: [],
        rbf: false,
        satsPerByte: 3002,
        scriptHash:
          "ad84bc285fa52dcfb75d97ad35ae6ba8f39cc0d2b4def21cfd3a097afc9f531e",
        timestamp: 1708615960065,
        totalInputValue: 0.05076376,
        totalOutputValue: 0.046530390000000005,
        txid: "cf72a075b6d3ac209af7f16ac160c007f9daedc5b49b7bc025d5fb62b9b541bf",
        type: "received",
        value: 0.002,
        vin: [[Object]],
        vsize: 141,
      },
      e84224979b8e5091428baaf248c1f9adca1a630c85edd956d5d266708dc7ea3c: {
        address: "bcrt1qyzuqvk3e7tszrjcvqhm9qpvd2wyd4f0njuxgj9",
        confirmTimestamp: 1708616078000,
        exists: true,
        fee: 0.00000332,
        height: 20503,
        matchedInputValue: 0.004,
        matchedOutputValue: 0.00399668,
        messages: [],
        rbf: false,
        satsPerByte: 3,
        scriptHash:
          "e7566598328396b2baa5397bde1a8bb59b07e9da7b1ea46ed9a131c148ab4011",
        timestamp: 1708616072167,
        totalInputValue: 0.004,
        totalOutputValue: 0.00399668,
        txid: "e84224979b8e5091428baaf248c1f9adca1a630c85edd956d5d266708dc7ea3c",
        type: "sent",
        value: -0.00000332,
        vin: [[Object]],
        vsize: 110,
      },
    } as unknown as IFormattedTransactions;

    l.syncHistory({
      lnChannelClose: [],
      lnChannelOpen: [],
      lnClaim: [],
      lnSent: [],
      onchain,
    });
    const first = l.ledger.getTransactions();
    expect(l.ledger.getWalletBalance("onchain")).toEqual({
      available: 399668,
      hold: 0,
    });

    l.syncHistory({
      lnChannelClose: [],
      lnChannelOpen: [],
      lnClaim: [],
      lnSent: [],
      onchain,
    });
    const second = l.ledger.getTransactions();
    expect(l.ledger.getWalletBalance("onchain")).toEqual({
      available: 399668,
      hold: 0,
    });

    expect(first).toEqual(second);
  });

  it("can sync LN", () => {
    const l = new BitkitLedger();
    l.initEmptyLedger();

    const lnClaim = [
      {
        amount_sat: 100,
        payment_hash: "p1",
        state: "successful",
        unix_timestamp: 1,
      },
      {
        amount_sat: 300,
        payment_hash: "p3",
        state: "pending",
        unix_timestamp: 3,
      },
    ] as TChannelManagerClaim[];

    const lnSent = [
      {
        amount_sat: 200,
        fee_paid_sat: 1,
        payment_hash: "p2",
        state: "successful",
        unix_timestamp: 2,
      },
    ] as TChannelManagerPaymentSent[];

    l.syncHistory({
      lnChannelClose: [],
      lnChannelOpen: [],
      lnClaim,
      lnSent,
      onchain: {},
    });

    expect(l.ledger.getWalletBalance("lightning")).toEqual({
      available: -101,
      hold: 300,
    });
  });

  it("can sync LN channels", () => {
    const l = new BitkitLedger();
    l.initEmptyLedger();

    // channels is not ready yet
    const channels1 = [
      {
        balance_sat: 0,
        channel_id:
          "17a608e77c24796d33dda3e8353c30f309da8765bdbcf546b9920403bf31dcd3",
        channel_type: "401000",
        channel_value_satoshis: 200002,
        config_forwarding_fee_base_msat: 1000,
        config_forwarding_fee_proportional_millionths: 0,
        confirmations: 0,
        confirmations_required: 1,
        counterparty_node_id:
          "02cba1a85b4fa1788b14676439c4ba650ce1372d979b79c896a36f0f040984e098",
        force_close_spend_delay: 144,
        funding_txid:
          "d3dc31bf030492b946f5bcbd6587da09f3303c35e8a3dd336d79247ce708a617",
        inbound_capacity_sat: 198002,
        inbound_payment_scid: null,
        inbound_scid_alias: "",
        is_channel_ready: false,
        is_outbound: false,
        is_public: false,
        is_usable: false,
        outbound_capacity_sat: 0,
        short_channel_id: "",
        timestamp: 1,
        unspendable_punishment_reserve: 2000,
        user_channel_id: "80812529167a22ecdc9a0a29d7978864",
      },
    ] as unknown as TChannelTimestamp[];

    l.syncHistory({
      lnChannelClose: [],
      lnChannelOpen: channels1,
      lnClaim: [],
      lnSent: [],
      onchain: {},
    });

    expect(l.ledger.getWalletBalance("lightning")).toEqual({
      available: 0,
      hold: 0,
    });

    const channels2 = [
      {
        balance_sat: 0,
        channel_id:
          "17a608e77c24796d33dda3e8353c30f309da8765bdbcf546b9920403bf31dcd3",
        channel_type: "401000",
        channel_value_satoshis: 200002,
        config_forwarding_fee_base_msat: 1000,
        config_forwarding_fee_proportional_millionths: 0,
        confirmations: 10,
        confirmations_required: 1,
        counterparty_node_id:
          "02cba1a85b4fa1788b14676439c4ba650ce1372d979b79c896a36f0f040984e098",
        force_close_spend_delay: 144,
        funding_txid:
          "d3dc31bf030492b946f5bcbd6587da09f3303c35e8a3dd336d79247ce708a617",
        inbound_capacity_sat: 198002,
        inbound_payment_scid: 133040907026432,
        inbound_scid_alias: "133040907026432",
        is_channel_ready: true,
        is_outbound: false,
        is_public: false,
        is_usable: true,
        outbound_capacity_sat: 0,
        short_channel_id: "133040907026432",
        unspendable_punishment_reserve: 2000,
        user_channel_id: "33eec6e651239a80273e7cba469771b3",
      },
    ] as unknown as TChannelTimestamp[];

    l.syncHistory({
      lnChannelClose: [],
      lnChannelOpen: channels2,
      lnClaim: [],
      lnSent: [],
      onchain: {},
    });

    expect(l.ledger.getWalletBalance("lightning")).toEqual({
      available: 0,
      hold: 0,
    });

    expect(l.ledger.getTransactions().length).toBe(2);
  });
});
