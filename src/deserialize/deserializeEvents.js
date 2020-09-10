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

function deserializeEvents(logs = []) {
  return (logs || []).filter(v => v.Name === 'TokenBought' || v.Name === 'TokenSold')
    .map(item => {
      const {
        Name,
        NonIndexed,
        Indexed = []
      } = item;
      const serializedData = [...(Indexed || [])];
      if (NonIndexed) {
        serializedData.push(NonIndexed);
      }
      const dataType = tokenConverterContractRoot.lookupType(Name);
      let deserializeLogResult = serializedData.reduce((acc, v) => {
        let deserialize = dataType.decode(Buffer.from(v, 'base64'));
        deserialize = dataType.toObject(deserialize, {
          enums: String, // enums as string names
          longs: String, // longs as strings (requires long.js)
          bytes: String, // bytes as base64 encoded strings
          defaults: false, // includes default values
          arrays: true, // populates empty arrays (repeated fields) even if defaults=false
          objects: true, // populates empty objects (map fields) even if defaults=false
          oneofs: true // includes virtual oneof fields set to the present field's name
        });
        return {
          ...acc,
          ...deserialize
        };
      }, {});
      // eslint-disable-next-line max-len
      deserializeLogResult = AElf.utils.transform.transform(dataType, deserializeLogResult, AElf.utils.transform.OUTPUT_TRANSFORMERS);
      deserializeLogResult = AElf.utils.transform.transformArrayToMap(dataType, deserializeLogResult);
      return deserializeLogResult;
    });
}

module.exports = deserializeEvents;
