// / need to load the buffer package from dependency instead of use node default buffer
import { Buffer } from 'buffer/';
import { UhkBuffer } from '../uhk-buffer';

export class Extension {
    uri: string;
    data: Buffer;

    toJsonObject(): any {
        return {
            uri: this.uri,
            data: this.data.toString("hex"),
        };
    }
    fromJsonObject(jsonObject: any, version: number): Extension {
        this.uri = jsonObject.uri;
        this.data = Buffer.from(jsonObject.data, "hex")
        
        return this;
    }


    toBinary(buffer: UhkBuffer): void {
        let endOffset = buffer.offset;
        buffer.writeBuffer(this.data);
        buffer.writeString(this.uri);
    }
    fromBinary(buffer: UhkBuffer, version: number): Extension {
        const maxOffset = buffer.readCompactLength() + buffer.offset;
        this.uri = buffer.readString();
        this.data = buffer.readBuffer();

        return this;
    }
}