import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_MUTATIONS_KEY = '@pending_mutations';

export interface Mutation {
    id: string;
    endpoint: string;
    options: any;
    timestamp: number;
    description: string;
}

export const offlineStore = {
    async getPendingMutations(): Promise<Mutation[]> {
        const data = await AsyncStorage.getItem(PENDING_MUTATIONS_KEY);
        return data ? JSON.parse(data) : [];
    },

    async addMutation(mutation: Omit<Mutation, 'id' | 'timestamp'>) {
        const mutations = await this.getPendingMutations();
        mutations.push({
            ...mutation,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: Date.now(),
        });
        await AsyncStorage.setItem(PENDING_MUTATIONS_KEY, JSON.stringify(mutations));
    },

    async clearMutations() {
        await AsyncStorage.removeItem(PENDING_MUTATIONS_KEY);
    },

    async removeMutation(id: string) {
        const mutations = await this.getPendingMutations();
        const updated = mutations.filter((m) => m.id !== id);
        await AsyncStorage.setItem(PENDING_MUTATIONS_KEY, JSON.stringify(updated));
    },

    // Simple cache for GET requests
    async getCache(key: string): Promise<any> {
        const data = await AsyncStorage.getItem(`@cache_${key}`);
        return data ? JSON.parse(data) : null;
    },

    async setCache(key: string, data: any) {
        await AsyncStorage.setItem(`@cache_${key}`, JSON.stringify(data));
    }
};
