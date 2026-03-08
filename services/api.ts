import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { offlineStore } from './offline';

const getBaseUrl = () => {
    if (Platform.OS === 'web') {
        return 'http://localhost:5000';
    }

    const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
    if (hostUri) {
        const ip = hostUri.split(':')[0];
        return `http://${ip}:5000`;
    }

    return 'http://10.17.244.82:5000';
};

const BASE_URL = getBaseUrl();

class ApiService {
    private baseUrl: string;
    private token: string | null = null;

    constructor() {
        this.baseUrl = `${BASE_URL}/api`;
    }

    async setToken(token: string | null) {
        this.token = token;
        if (token) {
            await AsyncStorage.setItem('auth_token', token);
        } else {
            await AsyncStorage.removeItem('auth_token');
        }
    }

    async getToken(): Promise<string | null> {
        if (this.token) return this.token;
        this.token = await AsyncStorage.getItem('auth_token');
        return this.token;
    }

    private async getHeaders(isFormData = false): Promise<Record<string, string>> {
        const token = await this.getToken();
        const headers: Record<string, string> = {};
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    async request<T>(
        endpoint: string,
        options: {
            method?: string;
            body?: any;
            params?: Record<string, string>;
        } = {}
    ): Promise<T> {
        const { method = 'GET', body, params } = options;

        let url = `${this.baseUrl}${endpoint}`;
        if (params) {
            const queryString = new URLSearchParams(params).toString();
            url += `?${queryString}`;
        }

        const isFormData = body instanceof FormData;
        const headers = await this.getHeaders(isFormData);

        const config: RequestInit = {
            method,
            headers,
        };

        if (body) {
            config.body = isFormData ? body : JSON.stringify(body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Something went wrong');
            }

            // Cache GET requests
            if (method === 'GET') {
                await offlineStore.setCache(url, data);
            }

            return data as T;
        } catch (error: any) {
            if (
                error.message === 'Network request failed' ||
                error.message.includes('Network')
            ) {
                if (method === 'GET') {
                    const cached = await offlineStore.getCache(url);
                    if (cached) return cached as T;
                    throw new Error('Offline. No cached data available.');
                } else if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
                    // Do not store auth mutations offline (login/register)
                    if (!url.includes('/auth/') && !isFormData && body) {
                        let description = 'Update data';
                        if (url.includes('progress')) description = 'Update progress';
                        if (url.includes('collections')) description = 'Update collection';

                        await offlineStore.addMutation({
                            endpoint: url.replace(this.baseUrl, ''),
                            options: { method, body },
                            description
                        });
                        throw new Error('You are offline. Change saved locally and will be synced later.');
                    }
                }
                throw new Error('Unable to connect to server. Please check your connection.');
            }
            throw error;
        }
    }

    async syncMutations(): Promise<number> {
        const mutations = await offlineStore.getPendingMutations();
        if (mutations.length === 0) return 0;

        let synced = 0;
        for (const m of mutations) {
            try {
                await this.request(m.endpoint, m.options);
                await offlineStore.removeMutation(m.id);
                synced++;
            } catch (err: any) {
                if (!err.message?.includes('Network')) {
                    // Remove if it's a server error like 400 since it won't ever succeed
                    await offlineStore.removeMutation(m.id);
                }
            }
        }
        return synced;
    }

    // Auth
    async register(username: string, email: string, password: string) {
        return this.request<{ token: string; user: any }>('/auth/register', {
            method: 'POST',
            body: { username, email, password },
        });
    }

    async login(email: string, password: string) {
        return this.request<{ token: string; user: any }>('/auth/login', {
            method: 'POST',
            body: { email, password },
        });
    }

    async getMe() {
        return this.request<any>('/auth/me');
    }

    async updateProfile(data: any) {
        return this.request<any>('/auth/profile', { method: 'PUT', body: data });
    }

    // Stories
    async createStory(data: any) {
        return this.request<any>('/stories', { method: 'POST', body: data });
    }

    async getStories(params?: { page?: string; limit?: string; search?: string; type?: string; genre?: string; sort?: string }) {
        return this.request<{ stories: any[]; totalPages: number; currentPage: number; total: number }>(
            '/stories',
            { params }
        );
    }

    async getStory(id: string) {
        return this.request<{ story: any; userProgress: any; reviews: any[]; isRecommended: boolean }>(`/stories/${id}`);
    }

    async updateStory(id: string, data: any) {
        return this.request<any>(`/stories/${id}`, { method: 'PUT', body: data });
    }

    async deleteStory(id: string) {
        return this.request<any>(`/stories/${id}`, { method: 'DELETE' });
    }

    async likeStory(id: string) {
        return this.request<{ isLiked: boolean; isDisliked: boolean; likesCount: number; dislikesCount: number }>(`/stories/${id}/like`, { method: 'POST' });
    }

    async dislikeStory(id: string) {
        return this.request<{ isLiked: boolean; isDisliked: boolean; likesCount: number; dislikesCount: number }>(`/stories/${id}/dislike`, { method: 'POST' });
    }

    async recommendStory(storyId: string, message?: string) {
        return this.request<{ message: string; isRecommended: boolean }>('/social/recommend', { method: 'POST', body: { storyId, message } });
    }

    // Progress
    async updateProgress(data: {
        storyId: string;
        currentChapter?: number;
        status?: string;
        notes?: string;
        isFavorite?: boolean;
        rating?: number;
    }) {
        return this.request<any>('/progress', { method: 'POST', body: data });
    }

    async getMyProgress(params?: { status?: string }) {
        return this.request<any[]>('/progress', { params });
    }

    async getProgressStats() {
        return this.request<any>('/progress/stats');
    }

    async incrementChapter(progressId: string) {
        return this.request<any>(`/progress/${progressId}/increment`, { method: 'PUT' });
    }

    async toggleFavorite(storyId: string) {
        return this.request<{ isFavorite: boolean }>(`/progress/${storyId}/favorite`, { method: 'PUT' });
    }

    async removeFromLibrary(storyId: string) {
        return this.request<any>(`/progress/${storyId}`, { method: 'DELETE' });
    }

    async getUserProgress(userId: string) {
        return this.request<any[]>(`/progress/user/${userId}`);
    }

    // Reviews
    async createReview(data: { storyId: string; rating: number; title?: string; text?: string; spoiler?: boolean }) {
        return this.request<any>('/reviews', { method: 'POST', body: data });
    }

    async getStoryReviews(storyId: string, params?: { page?: string; limit?: string }) {
        return this.request<{ reviews: any[]; totalPages: number; total: number }>(
            `/reviews/story/${storyId}`,
            { params }
        );
    }

    async likeReview(reviewId: string) {
        return this.request<any>(`/reviews/${reviewId}/like`, { method: 'PUT' });
    }

    async deleteReview(reviewId: string) {
        return this.request<any>(`/reviews/${reviewId}`, { method: 'DELETE' });
    }

    // Collections
    async createCollection(data: { name: string; description?: string; isPublic?: boolean; color?: string }) {
        return this.request<any>('/collections', { method: 'POST', body: data });
    }

    async getMyCollections() {
        return this.request<any[]>('/collections');
    }

    async getCollection(id: string) {
        return this.request<any>(`/collections/${id}`);
    }

    async updateCollection(id: string, data: any) {
        return this.request<any>(`/collections/${id}`, { method: 'PUT', body: data });
    }

    async addToCollection(collectionId: string, storyId: string) {
        return this.request<any>(`/collections/${collectionId}/stories`, {
            method: 'PUT',
            body: { storyId },
        });
    }

    async removeFromCollection(collectionId: string, storyId: string) {
        return this.request<any>(`/collections/${collectionId}/stories/${storyId}`, {
            method: 'DELETE',
        });
    }

    async deleteCollection(id: string) {
        return this.request<any>(`/collections/${id}`, { method: 'DELETE' });
    }

    async cloneCollection(id: string) {
        return this.request<any>(`/collections/${id}/clone`, { method: 'POST' });
    }

    async getUserCollections(userId: string) {
        return this.request<any[]>(`/collections/user/${userId}`);
    }

    // Social
    async searchUsers(query: string) {
        return this.request<any[]>('/social/search', { params: { q: query } });
    }

    async sendFriendRequest(userId: string) {
        return this.request<any>('/social/friend-request', { method: 'POST', body: { userId } });
    }

    async getFriendRequests() {
        return this.request<any[]>('/social/friend-requests');
    }

    async getSentFriendRequests() {
        return this.request<any[]>('/social/friend-requests/sent');
    }

    async respondToFriendRequest(requestId: string, action: 'accept' | 'decline') {
        return this.request<any>(`/social/friend-request/${requestId}`, {
            method: 'PUT',
            body: { action },
        });
    }

    async cancelFriendRequest(requestId: string) {
        return this.request<any>(`/social/friend-request/${requestId}`, { method: 'DELETE' });
    }

    async removeFriend(userId: string) {
        return this.request<any>(`/social/friend/${userId}`, { method: 'DELETE' });
    }

    async getFriends() {
        return this.request<any[]>('/social/friends');
    }

    async getUserProfile(userId: string) {
        return this.request<any>(`/social/user/${userId}`);
    }

    async getFriendsActivity() {
        return this.request<any[]>('/social/activity');
    }

    async getFeed() {
        return this.request<{ feed: any[]; recommendations: any[] }>('/social/feed');
    }

    async getUserStats() {
        return this.request<any>('/progress/stats');
    }

    // MangaDex API (on-demand via proxy)
    async getMangaDexManga(params?: {
        title?: string;
        limit?: string;
        offset?: string;
        order?: string;
        orderDir?: string;
        status?: string;
        contentRating?: string;
        tags?: string;
    }) {
        return this.request<{ results: any[]; total: number; limit: number; offset: number }>('/mangadex/manga', { params });
    }

    async getMangaDexDetail(id: string) {
        return this.request<{ manga: any }>(`/mangadex/manga/${id}`);
    }

    async getMangaDexTags() {
        return this.request<{ tags: any[] }>('/mangadex/tags');
    }

    // Clone a MangaDex manga into local DB
    async cloneMangaDex(manga: {
        mangadexId: string;
        title: string;
        description?: string;
        coverImage?: string;
        author?: string;
        status?: string;
        totalChapters?: string;
        genres?: string[];
        year?: number;
    }) {
        return this.request<{ story: any; created: boolean; updated: boolean }>('/stories/clone-mangadex', {
            method: 'POST',
            body: manga,
        });
    }

    // Support & DevLog
    async submitFeedback(data: { content: string; category?: string }) {
        return this.request<any>('/support/feedback', { method: 'POST', body: data });
    }

    async submitBugReport(data: { title: string; description: string; images?: string[]; deviceInfo?: string }) {
        return this.request<any>('/support/bug-report', { method: 'POST', body: data });
    }

    async getDevLogs() {
        return this.request<any[]>('/devlog');
    }
}

export const api = new ApiService();
