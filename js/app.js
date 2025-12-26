class QuizApp {
    constructor() {
        this.db = new QuizDatabase();
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.selectedChoice = null;
        this.incorrectQuestions = [];
        this.correctCount = 0;
        this.isRetryMode = false;
        this.currentRoundQuestions = []; // 現在のラウンドの問題リスト
        this.wrongAnswersThisRound = []; // 今回のラウンドで間違えた問題
        
        this.initElements();
        this.bindEvents();
    }

    initElements() {
        this.elements = {
            loading: document.getElementById('loading'),
            quizContainer: document.getElementById('quiz-container'),
            completeSection: document.getElementById('complete-section'),
            questionTitle: document.getElementById('question-title'),
            questionContent: document.getElementById('question-content'),
            choices: document.getElementById('choices'),
            submitBtn: document.getElementById('submit-btn'),
            resultSection: document.getElementById('result-section'),
            resultMessage: document.getElementById('result-message'),
            explanation: document.getElementById('explanation'),
            nextBtn: document.getElementById('next-btn'),
            restartBtn: document.getElementById('restart-btn'),
            currentQuestion: document.getElementById('current-question'),
            totalQuestions: document.getElementById('total-questions'),
            correctCount: document.getElementById('correct-count')
        };
    }

    bindEvents() {
        this.elements.submitBtn.addEventListener('click', () => this.submitAnswer());
        this.elements.nextBtn.addEventListener('click', () => this.nextQuestion());
        this.elements.restartBtn.addEventListener('click', () => this.restart());
        
        // Service Worker登録（HTTPSまたはHTTPでのみ）
        if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.protocol === 'http:')) {
            navigator.serviceWorker.register('./sw.js').catch(error => {
                console.log('Service Worker registration failed:', error);
            });
        }
    }

    async init() {
        try {
            console.log('Initializing app...');
            await this.db.init();
            console.log('Database initialized');
            
            await this.loadQuestions();
            console.log('Questions loaded:', this.questions.length);
            console.log('Incorrect questions:', this.incorrectQuestions.length);
            
            this.startQuiz();
        } catch (error) {
            console.error('初期化エラー:', error);
            this.showError('アプリケーションの初期化に失敗しました: ' + error.message);
        }
    }

    async loadQuestions() {
        // まずマークダウンファイルから問題を読み込み
        await this.loadQuestionsFromMarkdown();
        
        // データベースから問題を読み込み
        this.questions = await this.db.getAllQuestions();
        
        // 進捗を確認して未正解の問題を特定
        const progress = await this.db.getAllProgress();
        const correctQuestionIds = progress
            .filter(p => p.isCorrect)
            .map(p => p.questionId);
        
        this.incorrectQuestions = this.questions.filter(q => 
            !correctQuestionIds.includes(q.id)
        );
        
        this.correctCount = correctQuestionIds.length;
        
        // 現在のラウンドの問題を設定
        this.setupCurrentRound();
    }

    setupCurrentRound() {
        if (this.incorrectQuestions.length > 0) {
            // 未正解の問題がある場合は、それらを現在のラウンドに設定
            this.currentRoundQuestions = [...this.incorrectQuestions];
            this.isRetryMode = false;
        } else {
            // すべて正解済みの場合は完了
            this.currentRoundQuestions = [];
        }
        
        this.wrongAnswersThisRound = [];
        this.currentQuestionIndex = 0;
    }

    async loadQuestionsFromMarkdown() {
        try {
            console.log('マークダウンファイルの読み込みを開始...');
            
            // questionsフォルダ内のマークダウンファイルリストを取得
            const markdownFiles = await this.getMarkdownFiles();
            console.log('検出されたファイル:', markdownFiles);
            
            if (markdownFiles.length === 0) {
                console.log('マークダウンファイルが見つかりませんでした');
                return;
            }
            
            // 既存の問題IDを取得
            const existingQuestions = await this.db.getAllQuestions();
            const existingIds = existingQuestions.map(q => q.id);
            console.log('既存の問題ID:', existingIds);
            
            for (const filename of markdownFiles) {
                try {
                    console.log(`ファイル ${filename} を読み込み中...`);
                    const response = await fetch(`questions/${filename}`);
                    console.log(`${filename} のレスポンス:`, response.status, response.ok);
                    
                    if (response.ok) {
                        const markdownContent = await response.text();
                        console.log(`${filename} の内容長:`, markdownContent.length);
                        
                        const question = MarkdownParser.parseQuestion(markdownContent);
                        console.log(`パースされた問題:`, question);
                        
                        if (question.id && question.title) {
                            // 既存の問題かチェック
                            if (existingIds.includes(question.id)) {
                                console.log(`問題を更新しました: ${question.title}`);
                                await this.updateExistingQuestion(question);
                            } else {
                                console.log(`新しい問題を追加しました: ${question.title}`);
                                await this.db.addQuestion(question);
                            }
                        } else {
                            console.error(`問題の形式が不正です:`, question);
                        }
                    }
                } catch (error) {
                    console.error(`ファイル ${filename} の読み込みエラー:`, error);
                }
            }
            
            // 読み込み後の問題数を確認
            const allQuestions = await this.db.getAllQuestions();
            console.log('読み込み完了後の問題数:', allQuestions.length);
            
        } catch (error) {
            console.error('マークダウンファイルの読み込みエラー:', error);
        }
    }

    async updateExistingQuestion(question) {
        // 既存の問題を更新（進捗情報は保持）
        const transaction = this.db.db.transaction(['questions'], 'readwrite');
        const store = transaction.objectStore('questions');
        return store.put(question);
    }

    // 開発用：データベースを完全にリセット
    async resetDatabase() {
        await this.db.resetProgress();
        const transaction = this.db.db.transaction(['questions'], 'readwrite');
        const store = transaction.objectStore('questions');
        await store.clear();
        console.log('データベースをリセットしました');
        location.reload();
    }

    // 開発用：マークダウンファイルの問題を直接追加
    async addMarkdownQuestions() {
        const questions = [
            {
                id: 'ec2-instance-types',
                title: 'EC2インスタンスタイプ',
                content: 'クラウド実践者は災害復旧計画を策定しており、複数の地理的エリア間でデータを複製する予定です。\nこれらの要件を満たすには、AWS クラウドのどのコンポーネントを使用する必要がありますか?',
                choices: [
                    'AWS アカウント',
                    'AWS リージョン',
                    'アベイラビリティ・ゾーン',
                    'エッジ・ロケーション'
                ],
                correctAnswer: 2,
                explanation: 'AWS でいうところの「災害」は、データセンターの障害ではなく、東京が沈没するぐらいの大災害を意味します。\nなので、災害復旧計画には、リージョン対策が必要です。\n\nデータセンター -> アベイラビリティ・ゾーンで十分\n地理的エリア -> リージョン対策が必要\n\nリージョンの中にアベイラビリティ・ゾーンがあります。\nエッジロケーションは、アクセスする人に近い場所にあるデータセンターのことで、アベイラビリティ・ゾーンよりもたくさんあります。\n\n2025 年 12 月時点\n- リージョン数: 38\n- アベイラビリティゾーン数: 117\n- エッジロケーション: 700 以上\n\n参考: [AWS グローバルインフラストラクチャ](https://aws.amazon.com/jp/about-aws/global-infrastructure/)'
            },
            {
                id: 'aws-iam-basic-concepts',
                title: 'AWS IAMの基本概念',
                content: 'クラウド実践者は災害復旧計画を策定しており、複数の地理的エリア間でデータを複製する予定です。\nこれらの要件を満たすには、AWS クラウドのどのコンポーネントを使用する必要がありますか?',
                choices: [
                    'AWS accounts',
                    'AWS Regions',
                    'Availability Zones',
                    'Edge locations'
                ],
                correctAnswer: 2,
                explanation: 'AWS でいう災害復旧は、例えば日本が半分沈むぐらいの大災害を指します。\nなので、災害対策として、**大阪リージョン** とか、**シンガポールリージョン**みたいな、かなり離れた場所にデータを複製する必要があります。'
            }
        ];

        for (const question of questions) {
            await this.db.addQuestion(question);
        }
        
        console.log('マークダウン問題を追加しました');
        location.reload();
    }

    async getMarkdownFiles() {
        // 01.md から 65.md までのファイルを検出
        const knownFiles = [];
        
        // 01から65までの番号付きファイルを生成
        for (let i = 1; i <= 65; i++) {
            const filename = String(i).padStart(2, '0') + '.md'; // 01.md, 02.md, ... 65.md
            knownFiles.push(filename);
        }
        
        const existingFiles = [];
        
        for (const filename of knownFiles) {
            try {
                const response = await fetch(`questions/${filename}`, { method: 'HEAD' });
                if (response.ok) {
                    existingFiles.push(filename);
                }
            } catch (error) {
                // ファイルが存在しない場合は無視
            }
        }
        
        return existingFiles;
    }

    startQuiz() {
        this.elements.loading.style.display = 'none';
        
        if (this.currentRoundQuestions.length === 0) {
            this.showComplete();
            return;
        }
        
        this.elements.quizContainer.style.display = 'block';
        this.updateProgress();
        this.showQuestion();
    }

    showQuestion() {
        if (this.currentQuestionIndex >= this.currentRoundQuestions.length) {
            // 現在のラウンドが終了
            this.handleRoundComplete();
            return;
        }
        
        const question = this.currentRoundQuestions[this.currentQuestionIndex];
        
        this.elements.questionTitle.textContent = question.title;
        this.elements.questionContent.innerHTML = MarkdownParser.renderMarkdown(question.content);
        
        // 選択肢を表示
        this.elements.choices.innerHTML = '';
        question.choices.forEach((choice, index) => {
            const button = document.createElement('button');
            button.className = 'choice';
            button.innerHTML = `${index + 1}. ${MarkdownParser.renderMarkdown(choice)}`;
            button.addEventListener('click', () => this.selectChoice(index + 1, button));
            this.elements.choices.appendChild(button);
        });
        
        // 結果セクションを非表示
        this.elements.resultSection.style.display = 'none';
        this.elements.submitBtn.disabled = true;
        this.selectedChoice = null;
    }

    selectChoice(choiceNumber, buttonElement) {
        console.log('Choice selected:', choiceNumber);
        
        // 既存の選択を解除
        document.querySelectorAll('.choice').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // 新しい選択を設定
        buttonElement.classList.add('selected');
        this.selectedChoice = choiceNumber;
        this.elements.submitBtn.disabled = false;
        
        console.log('Submit button enabled');
    }

    async submitAnswer() {
        console.log('submitAnswer called');
        console.log('selectedChoice:', this.selectedChoice);
        
        const question = this.currentRoundQuestions[this.currentQuestionIndex];
        console.log('current question:', question);
        
        const isCorrect = this.selectedChoice === question.correctAnswer;
        console.log('isCorrect:', isCorrect);
        
        // 進捗を更新
        try {
            await this.db.updateProgress(question.id, isCorrect);
            console.log('Progress updated successfully');
        } catch (error) {
            console.error('Error updating progress:', error);
        }
        
        // 選択肢の色を更新
        const choices = document.querySelectorAll('.choice');
        choices.forEach((choice, index) => {
            const choiceNumber = index + 1;
            if (choiceNumber === question.correctAnswer) {
                choice.classList.add('correct');
            } else if (choiceNumber === this.selectedChoice && !isCorrect) {
                choice.classList.add('incorrect');
            }
        });
        
        // 結果を表示
        this.showResult(isCorrect, question);
        
        if (isCorrect) {
            this.correctCount++;
        } else {
            // 間違えた問題を記録（重複チェック）
            if (!this.wrongAnswersThisRound.find(q => q.id === question.id)) {
                this.wrongAnswersThisRound.push(question);
            }
        }
        
        this.updateProgress();
    }

    handleRoundComplete() {
        if (this.wrongAnswersThisRound.length === 0) {
            // すべて正解した場合は完了
            this.showComplete();
        } else {
            // 間違えた問題で新しいラウンドを開始
            this.currentRoundQuestions = [...this.wrongAnswersThisRound];
            this.wrongAnswersThisRound = [];
            this.currentQuestionIndex = 0;
            this.isRetryMode = true;
            this.showQuestion();
        }
    }

    showResult(isCorrect, question) {
        console.log('showResult called:', isCorrect, question);
        
        try {
            this.elements.resultMessage.textContent = isCorrect ? '✅ 正解です！' : '❌ 不正解です';
            this.elements.resultMessage.className = `result-message ${isCorrect ? 'correct' : 'incorrect'}`;
            
            this.elements.explanation.innerHTML = `
                <h3>解説</h3>
                ${MarkdownParser.renderMarkdown(question.explanation)}
            `;
            
            this.elements.resultSection.style.display = 'block';
            this.elements.submitBtn.style.display = 'none';
            
            console.log('Result displayed successfully');
        } catch (error) {
            console.error('Error in showResult:', error);
        }
    }

    nextQuestion() {
        this.currentQuestionIndex++;
        this.elements.submitBtn.style.display = 'block';
        this.showQuestion();
    }

    showComplete() {
        this.elements.quizContainer.style.display = 'none';
        this.elements.completeSection.style.display = 'block';
    }

    async restart() {
        await this.db.resetProgress();
        this.correctCount = 0;
        await this.loadQuestions();
        this.elements.completeSection.style.display = 'none';
        this.startQuiz();
    }

    updateProgress() {
        const totalQuestions = this.questions.length;
        const currentRoundTotal = this.currentRoundQuestions.length;
        const currentPosition = this.currentQuestionIndex + 1;
        
        // 現在の問題番号を表示（現在のラウンド内での位置）
        this.elements.currentQuestion.textContent = Math.min(currentPosition, currentRoundTotal);
        this.elements.totalQuestions.textContent = currentRoundTotal;
        this.elements.correctCount.textContent = this.correctCount;
    }

    showError(message) {
        this.elements.loading.innerHTML = `<p style="color: red;">エラー: ${message}</p>`;
    }
}

// アプリケーション開始
document.addEventListener('DOMContentLoaded', () => {
    const app = new QuizApp();
    window.quizApp = app; // 開発用にグローバルアクセス可能にする
    app.init();
});