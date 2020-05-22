/**
 * @author hzz780
 * @description deserialize the data of token contract
 */

const AElf = require('aelf-sdk');
const {
  config
} = require('../common/constants');

const protobuf = AElf.pbjs;
const tokenContractRoot = protobuf.Root.fromDescriptor(config.proto.token);

function deserializeCrossChainTransferInput(base64Str) {
  let result = {};
  try {
    const transactionDecoded = AElf.pbUtils.Transaction.decode(Buffer.from(base64Str, 'base64'));
    const crossChainTransferInput = tokenContractRoot.nested.token.CrossChainTransferInput;
    const crossChainTransferInputDecoded = crossChainTransferInput.decode(transactionDecoded.params);
    result = crossChainTransferInput.toObject(crossChainTransferInputDecoded, {
      enums: String, // enums as string names
      longs: String, // longs as strings (requires long.js)
      bytes: String, // bytes as base64 encoded strings
      defaults: true, // includes default values
      arrays: true, // populates empty arrays (repeated fields) even if defaults=false
      objects: true, // populates empty objects (map fields) even if defaults=false
      oneofs: true // includes virtual oneof fields set to the present field's name
    });
    result.to = AElf.pbUtils.getRepForAddress(result.to);
  } catch (e) {
    result.to = 'tx failed';
  }
  return result;
}

module.exports = {
  deserializeCrossChainTransferInput
};
