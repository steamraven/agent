// / need to load the buffer package from dependency instead of use node default buffer
import { Buffer } from 'buffer/';

export class UhkBuffer {

    static simpleElementWriter<T>(buffer: UhkBuffer, element: T): void {
        (<any>element).toBinary(buffer); // TODO: Remove any
    }

    static fromArray(data: Array<number>): UhkBuffer {
        if (data.length < 1) {
            return null;
        }

        const uhkBuffer = new UhkBuffer();
        let hasNonZeroValue = false;
        for (const num of data) {
            if (num > 0) {
                hasNonZeroValue = true;
            }
            uhkBuffer.writeUInt8(num);
        }
        uhkBuffer.offset = 0;

        return uhkBuffer;
    }

    private static maxCompactLength = 0xFFFF;
    private static longCompactLengthPrefix = 0xFF;
    private static stringEncoding = 'utf8';
    private static isFirstElementToDump = false;

    offset: number;
    private _enableDump = false;

    private buffer: Buffer;
    private bytesToBacktrack: number;

    constructor(private eepromSize = 65536) {
        this.offset = 0;
        this.bytesToBacktrack = 0;
        this.buffer = Buffer.alloc(eepromSize);
        this.buffer.fill(0);
    }

    prepareWrite(): void {
        if (this.offset === 0) {
            this.offset = this.buffer.length;
        }
    }

    readInt8(): number {
        const value = this.buffer.readInt8(this.offset);
        this.dump(`i8(${value})`);
        this.bytesToBacktrack = 1;
        this.offset += this.bytesToBacktrack;
        return value;
    }

    writeInt8(value: number): void {
        this.dump(`i8(${value})`);
        this.offset -= 1;
        this.buffer.writeInt8(value, this.offset);
    }

    readUInt8(): number {
        const value = this.buffer.readUInt8(this.offset);
        this.dump(`u8(${value})`);
        this.bytesToBacktrack = 1;
        this.offset += this.bytesToBacktrack;
        return value;
    }

    writeUInt8(value: number): void {
        this.dump(`u8(${value})`);
        this.offset -= 1;
        this.buffer.writeUInt8(value, this.offset);
    }

    readInt16(): number {
        const value = this.buffer.readInt16LE(this.offset);
        this.dump(`i16(${value})`);
        this.bytesToBacktrack = 2;
        this.offset += this.bytesToBacktrack;
        return value;
    }

    writeInt16(value: number): void {
        this.dump(`i16(${value})`);
        this.offset -= 2;
        this.buffer.writeInt16LE(value, this.offset);
    }

    readUInt16(): number {
        const value = this.buffer.readUInt16LE(this.offset);
        this.dump(`u16(${value})`);
        this.bytesToBacktrack = 2;
        this.offset += this.bytesToBacktrack;
        return value;
    }

    writeUInt16(value: number): void {
        this.dump(`u16(${value})`);
        this.offset -= 2;
        this.buffer.writeUInt16LE(value, this.offset);
    }

    readInt32(): number {
        const value = this.buffer.readInt32LE(this.offset);
        this.dump(`i32(${value})`);
        this.bytesToBacktrack = 4;
        this.offset += this.bytesToBacktrack;
        return value;
    }

    writeInt32(value: number): void {
        this.dump(`i32(${value})`);
        this.offset -= 4;
        this.buffer.writeInt32LE(value, this.offset);
    }

    readUInt32(): number {
        const value = this.buffer.readUInt32LE(this.offset);
        this.dump(`u32(${value})`);
        this.bytesToBacktrack = 4;
        this.offset += this.bytesToBacktrack;
        return value;
    }

    writeUInt32(value: number): void {
        this.dump(`u32(${value})`);
        this.offset -= 4;
        this.buffer.writeUInt32LE(value, this.offset);
    }

    readCompactLength(): number {
        let length = this.readUInt8();
        if (length === UhkBuffer.longCompactLengthPrefix) {
            length = this.readUInt16();
        }
        return length;
    }

    writeCompactLength(length: number) {
        if (length >= UhkBuffer.longCompactLengthPrefix) {
            this.writeUInt16(length);
            this.writeUInt8(UhkBuffer.longCompactLengthPrefix);
        } else {
            this.writeUInt8(length);
        }
    }

    readString(): string {
        const stringByteLength = this.readCompactLength();
        const str = this.buffer.toString(UhkBuffer.stringEncoding, this.offset, this.offset + stringByteLength);
        this.dump(`${UhkBuffer.stringEncoding}(${str})`);
        this.bytesToBacktrack = stringByteLength;
        this.offset += stringByteLength;
        return str;
    }

    writeString(str: string): void {
        const stringByteLength = Buffer.byteLength(str, UhkBuffer.stringEncoding);

        if (stringByteLength > UhkBuffer.maxCompactLength) {
            throw `Cannot serialize string: ${stringByteLength} bytes is larger
                   than the maximum allowed length of ${UhkBuffer.maxCompactLength} bytes`;
        }
        this.offset -= stringByteLength;
        this.buffer.write(str, this.offset, stringByteLength, UhkBuffer.stringEncoding);
        this.writeCompactLength(stringByteLength);
        this.dump(`${UhkBuffer.stringEncoding}(${str})`);
    }

    readBoolean(): boolean {
        return this.readUInt8() !== 0;
    }

    writeBoolean(bool: boolean) {
        this.writeUInt8(bool ? 1 : 0);
    }

    readArray<T>(elementReader: (buffer: UhkBuffer, index?: number) => T): T[] {
        const array: T[] = [];
        const length = this.readCompactLength();
        for (let i = 0; i < length; ++i) {
            array.push(elementReader(this, i));
        }
        return array;
    }

    writeArray<T>(
        array: T[],
        elementWriter: (buffer: UhkBuffer, element: T, index?: number) => void = UhkBuffer.simpleElementWriter
    ): void {
        const length = array.length;
        for (let i = length-1; i >= 0; --i) {
            elementWriter(this, array[i], i);
        }
        this.writeCompactLength(length);
    }

    readBuffer(): Buffer {
        const bufferByteLength = this.readCompactLength();
        const buffer = Buffer.from(this.buffer.slice(this.offset, this.offset+bufferByteLength));
        this.dump(`hex(${buffer.toString("hex")})`);
        this.bytesToBacktrack = bufferByteLength;
        this.offset += bufferByteLength;
        return buffer;
    }

    writeBuffer(buffer: Buffer): void {
        this.offset -= buffer.byteLength;
        buffer.copy(this.buffer, this.offset);
        this.writeCompactLength(buffer.byteLength);
        this.dump(`hex(${buffer.toString("hex")})`);
    }



    backtrack(): void {
        this.offset -= this.bytesToBacktrack;
        this.bytesToBacktrack = 0;
    }

    getBufferContent(): Buffer {
        return this.buffer.slice(this.offset);
    }

    get enableDump() {
        return this._enableDump;
    }

    set enableDump(value) {
        if (value) {
            UhkBuffer.isFirstElementToDump = true;
        }
        this._enableDump = value;
    }

    dump(value: any) {
        if (!this.enableDump) {
            return;
        }

        if (!UhkBuffer.isFirstElementToDump) {
            process.stdout.write(', ');
        }

        process.stdout.write(value);

        if (UhkBuffer.isFirstElementToDump) {
            UhkBuffer.isFirstElementToDump = false;
        }
    }

}
