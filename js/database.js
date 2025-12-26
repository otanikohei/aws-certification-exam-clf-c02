class QuizDatabase {
    constructor() {
        this.dbName = 'AWSQuizDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 問題ストア
                if (!db.objectStoreNames.contains('questions')) {
                    const questionStore = db.createObjectStore('questions', { keyPath: 'id' });
                    questionStore.createIndex('title', 'title', { unique: false });
                }

                // 進捗ストア
                if (!db.objectStoreNames.contains('progress')) {
                    const progressStore = db.createObjectStore('progress', { keyPath: 'questionId' });
                    progressStore.createIndex('isCorrect', 'isCorrect', { unique: false });
                    progressStore.createIndex('attempts', 'attempts', { unique: false });
                }

                // 設定ストア
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    async addQuestion(question) {
        const transaction = this.db.transaction(['questions'], 'readwrite');
        const store = transaction.objectStore('questions');
        return store.add(question);
    }

    async getAllQuestions() {
        const transaction = this.db.transaction(['questions'], 'readonly');
        const store = transaction.objectStore('questions');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getProgress(questionId) {
        const transaction = this.db.transaction(['progress'], 'readonly');
        const store = transaction.objectStore('progress');
        return new Promise((resolve, reject) => {
            const request = store.get(questionId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async updateProgress(questionId, isCorrect) {
        return new Promise(async (resolve, reject) => {
            try {
                // 既存の進捗を取得
                const existing = await this.getProgress(questionId);
                const progress = existing || {
                    questionId: questionId,
                    isCorrect: false,
                    attempts: 0,
                    lastAttempt: null
                };

                progress.attempts++;
                progress.lastAttempt = new Date();
                progress.isCorrect = isCorrect;

                // 新しいトランザクションで更新
                const transaction = this.db.transaction(['progress'], 'readwrite');
                const store = transaction.objectStore('progress');
                
                const request = store.put(progress);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    async getAllProgress() {
        const transaction = this.db.transaction(['progress'], 'readonly');
        const store = transaction.objectStore('progress');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async resetProgress() {
        const transaction = this.db.transaction(['progress'], 'readwrite');
        const store = transaction.objectStore('progress');
        return store.clear();
    }

    async getSetting(key) {
        const transaction = this.db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    }

    async setSetting(key, value) {
        const transaction = this.db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        return store.put({ key, value });
    }
}