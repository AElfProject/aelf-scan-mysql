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
  NODE_INFOS: 'nodes_0'
};

const TABLE_COLUMNS = {
  CONTRACT: [
    'contract_address',
    'chain_id',
    'block_hash',
    'tx_id',
    'symbol',
    'name',
    'total_supply',
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
  const contractAddress = {};
  const wallet = AElf.wallet.getWalletByPrivateKey(config.wallet.privateKey);
  const aelf = new AElf(new AElf.providers.HttpProvider(config.scan.host));
  const {
    GenesisContractAddress
  } = aelf.chain.getChainStatus({
    sync: true
  });
  const genContract = aelf.chain.contractAt(GenesisContractAddress, wallet, {
    sync: true
  });

  Object.entries(contracts).forEach(([key, value]) => {
    contractAddress[key] = genContract.GetContractAddressByName.call(AElf.utils.sha256(value), {
      sync: true
    });
  });
  console.log(contractAddress);
  return contractAddress;
}

function getProto(address) {
  const aelf = new AElf(new AElf.providers.HttpProvider(config.scan.host));
  return aelf.chain.getContractFileDescriptorSet(address, { sync: true });
}

config.contracts = {
  ...getContractAddress(config.contracts)
};

config.proto = {
  resource: getProto(config.contracts.resource)
};

module.exports = {
  TABLE_NAME,
  TABLE_COLUMNS,
  config
};
