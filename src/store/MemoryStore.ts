import type { Keypair } from '@solana/web3.js';
import type { Users, PendingRequestsType, PendingRequestEntry } from '../types/inMemory';

class MemoryStore {
    private users: Users;
    private pendingRequests: PendingRequestsType;

    constructor() {
        this.users = {};
        this.pendingRequests = {};
    }

    public getUser(userId: string | number): Keypair | undefined {
        return this.users[userId.toString()];
    }

    public setUser(userId: string | number, keypair: Keypair): void {
        this.users[userId.toString()] = keypair;
    }

    public getPendingRequest(userId: string | number): PendingRequestEntry | undefined {
        return this.pendingRequests[userId.toString()];
    }

    public setPendingRequest(userId: string | number, request: PendingRequestEntry): void {
        this.pendingRequests[userId.toString()] = request;
    }

    public updatePendingRequestTo(userId: string | number, to: string): void {
        const req = this.pendingRequests[userId.toString()];
        if (req) {
            req.to = to;
        }
    }

    public deletePendingRequest(userId: string | number): void {
        delete this.pendingRequests[userId.toString()];
    }
}

export const store = new MemoryStore();
