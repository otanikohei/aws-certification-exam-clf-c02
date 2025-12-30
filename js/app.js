class QuizApp {
    constructor() {
        this.db = new QuizDatabase();
        this.availableQuestionNumbers = []; // 利用可能な問題番号のリスト
        this.currentQuestionIndex = 0;
        this.selectedChoices = []; // 複数選択対応
        this.incorrectQuestionNumbers = []; // 間違えた問題番号
        this.correctCount = 0;
        this.isRetryMode = false;
        this.currentRoundQuestionNumbers = []; // 現在のラウンドの問題番号リスト
        this.wrongAnswersThisRound = []; // 今回のラウンドで間違えた問題番号
        this.currentQuestion = null; // 現在表示中の問題
        
        this.initElements();
        this.bindEvents();
    }

    initElements() {
        this.elements = {
            loading: document.getElementById('loading'),
            progressBar: document.getElementById('progress-bar'),
            loadingStatus: document.getElementById('loading-status'),
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
        
        // キーボードショートカット
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Service Worker登録（HTTPSまたはHTTPでのみ）
        if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.protocol === 'http:')) {
            navigator.serviceWorker.register('./sw.js').catch(error => {
                console.log('Service Worker registration failed:', error);
            });
        }
    }

    handleKeyPress(e) {
        // クイズ画面が表示されていない場合は無視
        if (this.elements.quizContainer.style.display === 'none') return;
        
        const key = e.key.toUpperCase();
        
        // A〜Eキーで選択肢を選択
        if (['A', 'B', 'C', 'D', 'E'].includes(key)) {
            const choiceIndex = key.charCodeAt(0) - 'A'.charCodeAt(0);
            const choiceButtons = document.querySelectorAll('.choice');
            
            if (choiceIndex < choiceButtons.length) {
                const button = choiceButtons[choiceIndex];
                const choiceNumber = choiceIndex + 1;
                const isMultiple = this.currentQuestion?.isMultipleChoice || false;
                this.selectChoice(choiceNumber, button, isMultiple);
            }
        }
        
        // Enterキーで決定または次へ
        if (e.key === 'Enter') {
            if (this.elements.resultSection.style.display !== 'none') {
                // 結果表示中なら次の問題へ
                this.nextQuestion();
            } else if (!this.elements.submitBtn.disabled) {
                // 選択済みなら決定
                this.submitAnswer();
            }
        }
    }

    async init() {
        try {
            console.log('Initializing app...');
            await this.db.init();
            console.log('Database initialized');
            
            await this.loadAvailableQuestions();
            console.log('Available questions loaded:', this.availableQuestionNumbers.length);
            console.log('Incorrect question numbers:', this.incorrectQuestionNumbers.length);
            
            this.startQuiz();
        } catch (error) {
            console.error('初期化エラー:', error);
            this.showError('アプリケーションの初期化に失敗しました: ' + error.message);
        }
    }

    async loadAvailableQuestions() {
        console.log('利用可能な問題を確認中...');
        
        // 利用可能な問題番号を取得
        this.availableQuestionNumbers = await this.getAvailableQuestionNumbers();
        console.log('利用可能な問題番号:', this.availableQuestionNumbers);
        
        if (this.availableQuestionNumbers.length === 0) {
            console.log('問題が見つかりませんでした');
            return;
        }
        
        // 進捗を確認して未正解の問題番号を特定
        const progress = await this.db.getAllProgress();
        const correctQuestionIds = progress
            .filter(p => p.isCorrect)
            .map(p => p.questionId);
        
        // 未正解の問題番号を特定
        this.incorrectQuestionNumbers = this.availableQuestionNumbers.filter(num => {
            const questionId = this.generateQuestionId(num);
            return !correctQuestionIds.includes(questionId);
        });
        
        this.correctCount = correctQuestionIds.length;
        console.log('未正解の問題番号:', this.incorrectQuestionNumbers);
        
        // 現在のラウンドの問題を設定
        this.setupCurrentRound();
    }

    generateQuestionId(questionNumber) {
        return `question-${String(questionNumber).padStart(2, '0')}`;
    }

    async getAvailableQuestionNumbers() {
        const availableNumbers = [];
        const totalToCheck = 65;
        
        // 01から65までの番号をチェック
        for (let i = 1; i <= totalToCheck; i++) {
            try {
                const filename = String(i).padStart(2, '0') + '.md';
                const response = await fetch(`questions/${filename}`, { method: 'HEAD' });
                if (response.ok) {
                    availableNumbers.push(i);
                }
            } catch (error) {
                // ファイルが存在しない場合は無視
            }
            
            // プログレスバーを更新
            this.updateLoadingProgress(i, totalToCheck);
        }
        
        return availableNumbers;
    }

    updateLoadingProgress(current, total) {
        const percent = Math.round((current / total) * 100);
        if (this.elements.progressBar) {
            this.elements.progressBar.style.width = `${percent}%`;
        }
        if (this.elements.loadingStatus) {
            this.elements.loadingStatus.textContent = `${current} / ${total} 問`;
        }
    }

    async loadSingleQuestion(questionNumber) {
        try {
            const filename = String(questionNumber).padStart(2, '0') + '.md';
            console.log(`問題 ${questionNumber} を読み込み中...`);
            
            const response = await fetch(`questions/${filename}`);
            if (!response.ok) {
                throw new Error(`問題 ${questionNumber} の読み込みに失敗しました`);
            }
            
            const markdownContent = await response.text();
            const question = MarkdownParser.parseQuestion(markdownContent);
            
            // 問題IDを設定
            question.id = this.generateQuestionId(questionNumber);
            question.questionNumber = questionNumber;
            
            console.log(`問題 ${questionNumber} を読み込み完了:`, question.title);
            return question;
            
        } catch (error) {
            console.error(`問題 ${questionNumber} の読み込みエラー:`, error);
            throw error;
        }
    }

    setupCurrentRound() {
        if (this.incorrectQuestionNumbers.length > 0) {
            // 未正解の問題がある場合は、それらを現在のラウンドに設定
            this.currentRoundQuestionNumbers = [...this.incorrectQuestionNumbers];
            this.isRetryMode = false;
        } else {
            // すべて正解済みの場合は完了
            this.currentRoundQuestionNumbers = [];
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
        
        if (this.currentRoundQuestionNumbers.length === 0) {
            this.showComplete();
            return;
        }
        
        this.elements.quizContainer.style.display = 'block';
        this.updateProgress();
        this.showQuestion();
    }

    async showQuestion() {
        if (this.currentQuestionIndex >= this.currentRoundQuestionNumbers.length) {
            // 現在のラウンドが終了
            this.handleRoundComplete();
            return;
        }
        
        // 現在の問題番号を取得して読み込み
        const questionNumber = this.currentRoundQuestionNumbers[this.currentQuestionIndex];
        
        try {
            this.currentQuestion = await this.loadSingleQuestion(questionNumber);
        } catch (error) {
            console.error('問題の読み込みに失敗:', error);
            this.currentQuestionIndex++;
            this.showQuestion();
            return;
        }
        
        const question = this.currentQuestion;
        
        // 複数選択の場合はタイトルにヒントを追加
        let titleText = question.title;
        if (question.isMultipleChoice) {
            titleText += ` (${question.correctAnswers.length}つ選択)`;
        }
        this.elements.questionTitle.textContent = titleText;
        this.elements.questionContent.innerHTML = MarkdownParser.renderMarkdown(question.content);
        
        // 選択肢を表示
        this.elements.choices.innerHTML = '';
        question.choices.forEach((choice, index) => {
            const button = document.createElement('button');
            button.className = 'choice';
            button.innerHTML = `${String.fromCharCode(65 + index)}. ${MarkdownParser.renderMarkdown(choice)}`;
            button.addEventListener('click', () => this.selectChoice(index + 1, button, question.isMultipleChoice));
            this.elements.choices.appendChild(button);
        });
        
        // 結果セクションを非表示
        this.elements.resultSection.style.display = 'none';
        this.elements.submitBtn.disabled = true;
        this.selectedChoices = [];
    }

    selectChoice(choiceNumber, buttonElement, isMultipleChoice) {
        console.log('Choice selected:', choiceNumber, 'Multiple:', isMultipleChoice);
        
        if (isMultipleChoice) {
            // 複数選択モード
            if (this.selectedChoices.includes(choiceNumber)) {
                // 既に選択されている場合は解除
                this.selectedChoices = this.selectedChoices.filter(c => c !== choiceNumber);
                buttonElement.classList.remove('selected');
            } else {
                // 新しく選択
                this.selectedChoices.push(choiceNumber);
                buttonElement.classList.add('selected');
            }
            // 1つ以上選択されていれば決定ボタンを有効化
            this.elements.submitBtn.disabled = this.selectedChoices.length === 0;
        } else {
            // 単一選択モード
            document.querySelectorAll('.choice').forEach(btn => {
                btn.classList.remove('selected');
            });
            buttonElement.classList.add('selected');
            this.selectedChoices = [choiceNumber];
            this.elements.submitBtn.disabled = false;
        }
        
        console.log('Selected choices:', this.selectedChoices);
    }

    async submitAnswer() {
        console.log('submitAnswer called');
        console.log('selectedChoices:', this.selectedChoices);
        
        const question = this.currentQuestion;
        const questionNumber = this.currentRoundQuestionNumbers[this.currentQuestionIndex];
        console.log('current question:', question);
        
        // 選択数のバリデーション
        const requiredCount = question.isMultipleChoice ? question.correctAnswers.length : 1;
        const selectedCount = this.selectedChoices.length;
        
        if (selectedCount !== requiredCount) {
            alert(`${requiredCount}つ選択してください（現在${selectedCount}つ選択中）`);
            return;
        }
        
        // 正解判定
        let isCorrect;
        if (question.isMultipleChoice) {
            // 複数選択: 選択した回答と正解が完全一致するか
            const sortedSelected = [...this.selectedChoices].sort();
            const sortedCorrect = [...question.correctAnswers].sort();
            isCorrect = sortedSelected.length === sortedCorrect.length &&
                        sortedSelected.every((val, idx) => val === sortedCorrect[idx]);
        } else {
            // 単一選択
            isCorrect = this.selectedChoices[0] === question.correctAnswer;
        }
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
        const correctAnswers = question.correctAnswers || [question.correctAnswer];
        
        choices.forEach((choice, index) => {
            const choiceNumber = index + 1;
            if (correctAnswers.includes(choiceNumber)) {
                choice.classList.add('correct');
            } else if (this.selectedChoices.includes(choiceNumber) && !correctAnswers.includes(choiceNumber)) {
                choice.classList.add('incorrect');
            }
        });
        
        // 結果を表示
        this.showResult(isCorrect, question);
        
        if (isCorrect) {
            this.correctCount++;
        } else {
            // 間違えた問題番号を記録（重複チェック）
            if (!this.wrongAnswersThisRound.includes(questionNumber)) {
                this.wrongAnswersThisRound.push(questionNumber);
            }
        }
        
        this.updateProgress();
    }

    handleRoundComplete() {
        if (this.wrongAnswersThisRound.length === 0) {
            // すべて正解した場合は完了
            this.showComplete();
        } else {
            // 間違えた問題番号で新しいラウンドを開始
            this.currentRoundQuestionNumbers = [...this.wrongAnswersThisRound];
            this.wrongAnswersThisRound = [];
            this.currentQuestionIndex = 0;
            this.isRetryMode = true;
            this.updateProgress();
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
        await this.loadAvailableQuestions();
        this.elements.completeSection.style.display = 'none';
        this.startQuiz();
    }

    updateProgress() {
        const totalQuestions = this.availableQuestionNumbers.length;
        const currentRoundTotal = this.currentRoundQuestionNumbers.length;
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