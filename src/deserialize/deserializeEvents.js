/**
 * @file deserializeEvents.js
 * @author huangzongzhe
 */

const AElf = require('aelf-sdk');
const {
  config
} = require('../common/constants');

const protobuf = AElf.pbjs;

const tokenConverterContractRoot = protobuf.Root.fromDescriptor(config.proto.resource);

function deserializeEvents(logs) {
  let eventList = [];
  let outputList = [];
  if (logs) {
    eventList = logs.map(item => ({
      name: item.Name,
      base64StrList: [item.NonIndexed, ...(item.Indexed || [])]
    }));
    outputList = eventList.map(item => {
      let output = [];
      if (['TokenBought', 'TokenSold'].includes(item.name)) {
        output = item.base64StrList.map(strBase64 => {
          const dataBuffer = Buffer.from(strBase64, 'base64');
          const result = tokenConverterContractRoot[item.name].decode(dataBuffer);
          result.name = 'tokenTrade';
          return result;
        });
      }
      return output.reduce((acc, value) => ({
        ...acc,
        ...value
      }), {});
    });
  }
  return outputList;
}

module.exports = deserializeEvents;
