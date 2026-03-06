import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const getBaseUrl = () => {
    if (Platform.OS === 'web') {
        return 'http://localhost:5000';
    }
    return 'http://10.113.230.82:5000';
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

    private async getHeaders(): Promise<Record<string, string>> {
        const token = await this.getToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
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

        const headers = await this.getHeaders();

        const config: RequestInit = {
            method,
            headers,
        };

        if (body) {
            config.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Something went wrong');
            }

            return data as T;
        } catch (error: any) {
            if (error.message === 'Network request failed') {
                throw new Error('Unable to connect to server. Please check your connection.');
            }
            throw error;
        }
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

    async updateProfile(data: { username?: string; bio?: string; avatar?: string; favoriteGenres?: string[] }) {
        return this.request<any>('/auth/profile', { method: 'PUT', body: data });
    }

    // Stories
    async createStory(data: any) {
        return this.request<any>('/stories', { method: 'POST', body: data });
    }

    async getStories(params?: { page?: string; limit?: string; search?: string; type?: string; genre?: string }) {
        return this.request<{ stories: any[]; totalPages: number; currentPage: number; total: number }>(
            '/stories',
            { params }
        );
    }

    async getStory(id: string) {
        return this.request<{ story: any; userProgress: any; reviews: any[] }>(`/stories/${id}`);
    }

    async updateStory(id: string, data: any) {
        return this.request<any>(`/stories/${id}`, { method: 'PUT', body: data });
    }

    async deleteStory(id: string) {
        return this.request<any>(`/stories/${id}`, { method: 'DELETE' });
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
}

export const api = new ApiService();
