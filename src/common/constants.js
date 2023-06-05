/**
 * @file constants.js
 * @author atom-yang
 * @date 2019-07-24
 */
const AElf = require('aelf-sdk');
const utils = require('../common/utils');

const TABLE_NAME = {
  CONTRACT: 'contract_aelf20',
  TRANSACTION_CONFIRMED: 'transactions_0',
  TRANSACTION_UNCONFIRMED: 'transactions_unconfirmed',
  RESOURCE_CONFIRMED: 'resource_0',
  RESOURCE_UNCONFIRMED: 'resource_unconfirmed',
  BLOCKS_CONFIRMED: 'blocks_0',
  BLOCKS_UNCONFIRMED: 'blocks_unconfirmed',
  TRANS_PER_SECOND: 'tps_0',
  RESOURCE_TPS: 'tps_resource',
  TRANSACTION_TOKEN: 'transactions_token',
  TRANSACTION_TOKEN_UNCONFIRMED: 'transactions_token_unconfirmed',
  NODE_INFOS: 'nodes_0',
  EVENTS: 'events',
  TOKEN_TX: 'token_tx',
  BALANCE: 'balance'
};

const TABLE_COLUMNS = {
  CONTRACT: [
    'contract_address',
    'chain_id',
    'issue_chain_id',
    'tx_id',
    'symbol',
    'name',
    'total_supply',
    'supply',
    'decimals'
  ],
  TRANSACTION_CONFIRMED: [
    'tx_id',
    'params_to',
    'chain_id',
    'block_height',
    'address_from',
    'address_to',
    'params',
    'method',
    'block_hash',
    'tx_fee',
    'resources',
    'quantity',
    'tx_status',
    'time'
  ],
  TRANSACTION_UNCONFIRMED: [
    'tx_id',
    'params_to',
    'chain_id',
    'block_height',
    'address_from',
    'address_to',
    'params',
    'method',
    'block_hash',
    'tx_fee',
    'resources',
    'quantity',
    'tx_status',
    'time'
  ],
  RESOURCE_CONFIRMED: [
    'tx_id',
    'address',
    'method',
    'type',
    'resource',
    'elf',
    'fee',
    'chain_id',
    'block_height',
    'tx_status',
    'time'
  ],
  RESOURCE_UNCONFIRMED: [
    'tx_id',
    'address',
    'method',
    'type',
    'resource',
    'elf',
    'fee',
    'chain_id',
    'block_height',
    'tx_status',
    'time'
  ],
  BLOCKS_CONFIRMED: [
    'block_hash',
    'pre_block_hash',
    'chain_id',
    'block_height',
    'tx_count',
    'dividends',
    'miner',
    'tx_fee',
    'resources',
    'merkle_root_tx',
    'merkle_root_state',
    'time'
  ],
  BLOCKS_UNCONFIRMED: [
    'block_hash',
    'pre_block_hash',
    'chain_id',
    'block_height',
    'tx_count',
    'dividends',
    'miner',
    'tx_fee',
    'resources',
    'merkle_root_tx',
    'merkle_root_state',
    'time'
  ],
  TRANS_PER_SECOND: [
    'start',
    'end',
    'txs',
    'blocks',
    'tps',
    'tpm',
    'type'
  ],
  RESOURCE_TPS: [
    'start',
    'end',
    'txs',
    'blocks',
    'tps',
    'tpm',
    'type',
    'resource_type',
    'method'
  ],
  TRANSACTION_TOKEN: [
    'tx_id',
    'chain_id',
    'block_height',
    'symbol',
    'address_from',
    'address_to',
    'params',
    'method',
    'block_hash',
    'tx_status',
    'time'
  ],
  NODE_INFOS: [
    'contract_address',
    'chain_id',
    'api_ip',
    'api_domain',
    'rpc_ip',
    'rpc_domain',
    'token_name',
    'owner',
    'status'
  ],
  EVENTS: [
    'tx_id',
    'name',
    'address',
    'data'
  ],
  TOKEN_TX: [
    'tx_id',
    'symbol'
  ],
  BALANCE: [
    'owner',
    'symbol',
    'balance',
    'count',
    'updated_at'
  ]
};

let config = {};
if (utils.isProd) {
  // eslint-disable-next-line global-require
  config = require('../../config.prod');
} else {
  // eslint-disable-next-line global-require
  config = require('../../config.dev');
}

function getContractAddress(contracts) {
  const wallet = AElf.wallet.getWalletByPrivateKey(config.wallet.privateKey);
  const aelf = new AElf(new AElf.providers.HttpProvider(config.scan.host));
  const {
    GenesisContractAddress,
    ChainId
  } = aelf.chain.getChainStatus({
    sync: true
  });
  const contractAddress = {
    zero: GenesisContractAddress
  };
  const genContract = aelf.chain.contractAt(GenesisContractAddress, wallet, {
    sync: true
  });
  const dividendName = ChainId === 'AELF' ? 'Treasury' : 'Consensus';
  const dividendAddress = genContract.GetContractAddressByName.call(AElf.utils.sha256(
    `AElf.ContractNames.${dividendName}`
  ), {
    sync: true
  });
  config.chainId = ChainId;
  config.dividend = aelf.chain.contractAt(dividendAddress, wallet, {
    sync: true
  });

  Object.entries(contracts).forEach(([key, value]) => {
    if (key === 'portkey') {
      contractAddress[key] = value;
    } else {
      contractAddress[key] = genContract.GetContractAddressByName.call(AElf.utils.sha256(value), {
        sync: true
      });
    }
  });
  console.log(contractAddress);
  config.token = aelf.chain.contractAt(contractAddress.token, wallet, {
    sync: true
  });
  config.portkey = aelf.chain.contractAt(contractAddress.portkey, wallet, {
    sync: true
  });
  config.resource = aelf.chain.contractAt(contractAddress.resource, wallet, {
    sync: true
  });
  config.symbol = (config.token.GetNativeTokenInfo.call({
    sync: true
  })).symbol || 'ELF';
  config.aelf = aelf;
  // eslint-disable-next-line max-len
  contractAddress.crossChain = genContract.GetContractAddressByName.call(AElf.utils.sha256('AElf.ContractNames.CrossChain'), {
    sync: true
  });
  return contractAddress;
}

function getProto(address) {
  if (address) {
    const aelf = new AElf(new AElf.providers.HttpProvider(config.scan.host));
    return aelf.chain.getContractFileDescriptorSet(address, { sync: true });
  }
  return {};
}

config.contracts = {
  ...getContractAddress(config.contracts)
};

config.proto = {
  resource: getProto(config.contracts.resource),
  token: getProto(config.contracts.token)
};

module.exports = {
  TABLE_NAME,
  TABLE_COLUMNS,
  config
};
