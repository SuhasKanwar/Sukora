import type { PendingRequestsType, Users } from "../types/inMemory";

class MemoryStore {
    private users: Record<string, Users> = {};
    private pendingRequests: Record<string, PendingRequestsType> = {};
}