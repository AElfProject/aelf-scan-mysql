/**
 * @file deserializeParams.js
 * @author huangzongzhe
 *
 * 根据调用contract的情况来选择不同的proto来反序列化。
 */
const AElf = require('aelf-sdk');
const Long = require('long'); // For Token Contract

const { utils } = AElf;
const protobuf = AElf.pbjs;
const tokenContractPb = require('../../proto/token_contract.proto.json');

const tokenContractRoot = protobuf.Root.fromJSON(tokenContractPb);

const tokenConverterContractPb = require('../../proto/token_converter_contract.proto.json');

const tokenConverterContractRoot = protobuf.Root.fromJSON(tokenConverterContractPb);

const {
  config
} = require('../common/constants');

function deserializeParams(params, contractAddress, options = {}) {
  let output = '';
  const bufferTemp = Buffer.from(params, 'base64');
  if (contractAddress === config.contracts.token) {
    const method = (options.method || '').toLocaleLowerCase();
    let result = '';
    switch (method) {
      case 'create':
        result = tokenContractRoot.nested.token.CreateInput.decode(bufferTemp);
        result.issuer = utils.encodeAddressRep(result.issuer.Value.toString('hex'));
        result.totalSupplyStr = (new Long(result.totalSupply)).toString();
        break;
      case 'transfer':
        result = tokenContractRoot.nested.token.TransferInput.decode(bufferTemp);
        result.to = utils.encodeAddressRep(result.to.Value.toString('hex'));
        result.amountStr = (new Long(result.amount)).toString();
        break;
      default:
        break;
    }
    output = {
      ...result
    };
  } else if (contractAddress === config.contracts.tokenConverter) {
    const method = (options.method || '').toLocaleLowerCase();
    let result = '';
    switch (method) {
      case 'initialize':
        result = tokenConverterContractRoot.InitializeInput.decode(bufferTemp);
        break;
      case 'buy':
        result = tokenConverterContractRoot.BuyInput.decode(bufferTemp);
        result.amountStr = (new Long(result.amount)).toString();
        break;
      case 'sell':
        result = tokenConverterContractRoot.SellInput.decode(bufferTemp);
        result.amountStr = (new Long(result.amount)).toString();
        break;
      default:
        break;
    }
    output = {
      raw: params,
      json: {
        ...result
      }
    };
  }
  return output;
}

module.exports = deserializeParams;
