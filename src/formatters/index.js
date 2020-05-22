/**
 * @file formatter
 * @author atom-yang
 * @date 2019-07-23
 */
const AElf = require('aelf-sdk');
const deserializeEvents = require('../deserialize/deserializeEvents');
const {
  deserializeCrossChainTransferInput
} = require('../deserialize/deserializeTokenContract');
const { config } = require('../common/constants');
const {
  getDividend
} = require('../common/utils');

async function blockFormatter(block, transactions) {
  const fee = transactions.reduce((acc, tx) => tx.elf + acc, 0);
  const resourceFees = transactions.reduce((acc, tx) => {
    const { resources = {} } = tx;
    const result = {
      ...acc
    };
    Object.keys(resources).forEach(key => {
      result[key] = result[key] || 0 + resources[key];
    });
    return result;
  }, {});
  const { Header, Body, BlockHash } = block;
  const {
    PreviousBlockHash,
    ChainId,
    Height,
    MerkleTreeRootOfTransactions,
    MerkleTreeRootOfWorldState,
    Time,
    SignerPubkey
  } = Header;
  const miner = SignerPubkey ? AElf.wallet.getAddressFromPubKey(
    AElf.wallet.ellipticEc.keyFromPublic(SignerPubkey, 'hex').getPublic()
  ) : config.contracts.zero;
  const dividends = await getDividend(Height);

  return {
    block_hash: BlockHash,
    pre_block_hash: PreviousBlockHash,
    chain_id: ChainId,
    block_height: Height,
    tx_count: Body.TransactionsCount,
    merkle_root_tx: MerkleTreeRootOfTransactions,
    merkle_root_state: MerkleTreeRootOfWorldState,
    time: Time,
    tx_fee: fee,
    resources: JSON.stringify(resourceFees),
    dividends: JSON.stringify(dividends),
    miner
  };
}

/**
 * token created transactions
 * @param {Object} transaction
 * @return {Object}
 */
function tokenCreatedFormatter(transaction) {
  const {
    Logs = [],
    TransactionId
  } = transaction;
  return config.token.deserializeLog(Logs, 'TokenCreated').map(l => ({
    contract_address: config.contracts.token,
    chain_id: AElf.utils.chainIdConvertor.chainIdToBase58(l.issueChainId),
    tx_id: TransactionId,
    symbol: l.symbol,
    name: l.tokenName,
    total_supply: l.totalSupply,
    decimals: l.decimals
  }));
}

function resourceFormatter(transaction, block) {
  const {
    Logs = [],
    Status,
    Transaction,
    TransactionId
  } = transaction;
  const { From, MethodName } = Transaction;
  let params;
  try {
    params = JSON.parse(Transaction.Params);
  } catch (e) {
    params = {};
  }
  if (Status.toUpperCase() !== 'MINED') {
    return [
      {
        tx_id: TransactionId,
        address: From,
        method: MethodName,
        type: params.symbol || 'none',
        resource: parseInt(params.amount || 0, 10),
        elf: 0,
        fee: 0,
        chain_id: block.chain_id,
        block_height: block.block_height,
        tx_status: Status,
        time: block.time
      }
    ];
  }
  const eventsDeserialize = deserializeEvents(Logs);
  return eventsDeserialize.map(item => {
    const {
      symbol,
      boughtAmount,
      baseAmount,
      feeAmount,
      soldAmount
    } = item;
    return {
      tx_id: TransactionId,
      address: From,
      method: MethodName,
      type: symbol,
      resource: boughtAmount || soldAmount,
      elf: baseAmount,
      fee: feeAmount,
      chain_id: block.chain_id,
      block_height: block.block_height,
      tx_status: Status,
      time: block.time
    };
  });
}

function tokenRelatedFormatter(transaction, blockInfo) {
  const {
    Status,
    Transaction,
    TransactionId,
    BlockHash
  } = transaction;
  const {
    From,
    To,
    MethodName,
    Params
  } = Transaction;
  const params = JSON.parse(Params);
  const {
    symbol,
    to
  } = params;
  const result = {
    tx_id: TransactionId,
    chain_id: blockInfo.chain_id,
    block_height: blockInfo.block_height,
    symbol: symbol || 'none',
    address_from: From,
    address_to: to || To,
    params: JSON.stringify(params),
    method: MethodName,
    block_hash: BlockHash,
    tx_status: Status,
    time: blockInfo.time
  };
  if (
    [
      'CrossChainReceiveToken'
    ].includes(MethodName)
  ) {
    const crossTransfer = deserializeCrossChainTransferInput(params.transferTransactionBytes);
    result.address_to = crossTransfer.to || 'tx failed';
    result.symbol = crossTransfer.symbol || 'none';
    params.merklePath = null;
    params.transferTransactionBytes = null;
    params.transferTx = crossTransfer;
    result.params = JSON.stringify(params);
  }
  return result;
}

function transactionFormatter(transaction, blockInfo) {
  const txInfo = transaction.Transaction;
  // 处理一些奇怪的返回
  if (typeof txInfo === 'string') {
    return {
      tx_id: `tx_id${new Date().getTime() + Math.ceil(Math.random() * 100)}`,
      params_to: `params_to${new Date().getTime() + Math.ceil(Math.random() * 500)}`,
      chain_id: blockInfo.chain_id,
      block_height: parseInt(blockInfo.block_height, 10),
      address_from: '',
      address_to: '',
      params: txInfo,
      method: '',
      block_hash: blockInfo.block_hash,
      // increment_id: 0,
      quantity: 0, // TODO: 链上为BigInt类型, 所有涉及交易的步骤后续都需要修改。
      tx_status: transaction.Status,
      time: blockInfo.time,
      logs: transaction.Logs
    };
  }

  const method = txInfo.MethodName;

  const output = {
    tx_id: transaction.TransactionId,
    params_to: '',
    chain_id: blockInfo.chain_id,
    block_height: parseInt(blockInfo.block_height, 10),
    address_from: txInfo.From,
    address_to: txInfo.To,
    params: '',
    method: txInfo.MethodName,
    block_hash: blockInfo.block_hash,
    quantity: 0, // TODO: 链上为BigInt类型, 所有涉及交易的步骤后续都需要修改。
    tx_status: transaction.Status,
    time: blockInfo.time,
    logs: transaction.Logs,
    tx_fee: transaction.elf,
    resources: JSON.stringify(transaction.resources)
  };

  // 这一套规则是针对token合约的。
  const tokenMethodCheck = [
    'Initialize', 'Transfer', 'InitialBalance', 'Create', 'CrossChainTransfer', 'CrossChainReceiveToken'
  ].includes(txInfo.MethodName);

  if (!transaction.Status || (transaction.Status || '').toUpperCase() !== 'MINED') {
    return output;
  }

  if (txInfo.To === config.contracts.resource) {
    output.params = txInfo.Params;
  } else if (txInfo.To === config.contracts.token && tokenMethodCheck) {
    const paramsObject = JSON.parse(txInfo.Params);
    output.params = txInfo.Params;
    switch (method) {
      case 'Create':
        // 查支出时，需要排除掉method=Initialize这种情况。
        output.params_to = txInfo.To;
        output.quantity = paramsObject.totalSupply || 0;
        break;
      case 'Transfer':
        output.params_to = paramsObject.to || 'tx failed';
        output.quantity = paramsObject.amount || 0;
        break;
      case 'CrossChainTransfer':
        output.params_to = paramsObject.to || 'tx failed';
        output.quantity = paramsObject.amount || 0;
        break;
      case 'CrossChainReceiveToken': {
        const crossTransfer = deserializeCrossChainTransferInput(paramsObject.transferTransactionBytes);
        output.params_to = crossTransfer.to || 'tx failed';
        output.quantity = crossTransfer.amount || 0;
        output.params = paramsObject;
        output.params.merklePath = null;
        output.params.transferTransactionBytes = null;
        output.params.transferTx = crossTransfer;
        output.params = JSON.stringify(output.params);
        break;
      }
      default:
        break;
    }
  }
  return output;
}

module.exports = {
  blockFormatter,
  tokenCreatedFormatter,
  resourceFormatter,
  transactionFormatter,
  tokenRelatedFormatter
};
