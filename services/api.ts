import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { offlineStore } from './offline';

const getBaseUrl = () => {
    if (process.env.EXPO_PUBLIC_API_URL) {
        return process.env.EXPO_PUBLIC_API_URL;
    }

    if (Platform.OS === 'web') {
        return 'http://localhost:5000';
    }

    if (__DEV__) {
        const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost;
        if (hostUri) {
            const ip = hostUri.split(':')[0];
            return `http://${ip}:5000`;
        }
    }

    return 'https://api.chrollomark.com';
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
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        let requestBody: any = undefined;
        if (body) {
            requestBody = isFormData ? body : JSON.stringify(body);
        }

        const config: RequestInit = {
            method,
            headers,
            signal: controller.signal,
            body: requestBody,
        };

        try {
            const response = await fetch(url, config);
            clearTimeout(timeout);
            return await this.handleResponse<T>(response, url);
        } catch (error: any) {
            clearTimeout(timeout);
            return await this.handleError<T>(error, url, method, body, isFormData);
        }
    }

    private async handleResponse<T>(response: Response, url: string): Promise<T> {
        let data: any;
        const contentType = response.headers.get('content-type');

        try {
            if (contentType?.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                data = { message: text || `Server returned ${response.status}` };
            }
        } catch (e) {
            console.error('API Response Parse Error:', e);
            data = { message: `Failed to parse response (Status: ${response.status})` };
        }

        if (!response.ok) {
            if (response.status === 401 && !url.includes('/auth/login')) {
                await this.setToken(null);
                throw new Error('Session expired. Please log in again.');
            }
            throw new Error(data.message || `Request failed with status ${response.status}`);
        }

        if (response.status >= 200 && response.status < 300 && url.includes('GET')) {
            await offlineStore.setCache(url, data);
        }

        return data as T;
    }

    private async handleError<T>(
        error: any,
        url: string,
        method: string,
        body: any,
        isFormData: boolean
    ): Promise<T> {
        if (error.name === 'AbortError') {
            throw new Error('Connection timed out. The server is taking too long to respond.');
        }

        const isNetworkError =
            error.message === 'Network request failed' ||
            error.message.includes('Network') ||
            error.message.includes('fetch');

        if (isNetworkError) {
            // Handle offline scenarios
            if (method === 'GET') {
                const cached = await offlineStore.getCache(url);
                if (cached) return cached as T;
                throw new Error('You appear to be offline and no cached data is available.');
            }

            // Sync queue for mutations
            if (['POST', 'PUT', 'DELETE'].includes(method) && !url.includes('/auth/') && !isFormData && body) {
                await this.queueMutation(url, method, body);
                throw new Error('Action saved locally. It will sync when you are back online.');
            }

            throw new Error('Cannot connect to the server. Please check your internet connection.');
        }

        throw error;
    }

    private async queueMutation(url: string, method: string, body: any) {
        let description = 'Update data';
        if (url.includes('progress')) description = 'Update progress';
        if (url.includes('collections')) description = 'Update collection';

        await offlineStore.addMutation({
            endpoint: url.replace(this.baseUrl, ''),
            options: { method, body },
            description
        });
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
