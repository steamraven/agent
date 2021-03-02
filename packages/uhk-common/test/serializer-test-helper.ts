import { UhkBuffer } from '../src/config-serializer';

export function jsonDefaultHelper(baseObject: any, serializationParam?: any, deserializationParam?: any, version = 4): void {
    const json = baseObject.toJsonObject(serializationParam);
    const newObject = new baseObject.constructor;
    newObject.fromJsonObject(json, deserializationParam || version, version);

    expect(newObject).toEqual(baseObject);
}

export function binaryDefaultHelper(baseObject: any, serializerParam?: any, deserializationParam?: any, version = 4): void {
    const buffer = new UhkBuffer();
    buffer.prepareWrite();
    baseObject.toBinary(buffer, serializerParam);
    const newObject = new baseObject.constructor;
    newObject.fromBinary(buffer.getBufferContent(), deserializationParam || version, version);

    expect(newObject).toEqual(baseObject);
}
