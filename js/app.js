class QuizApp {
    constructor() {
        this.db = new QuizDatabase();
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.selectedChoice = null;
        this.incorrectQuestions = [];
        this.correctCount = 0;
        this.isRetryMode = false;
        
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
        // データベースから問題を読み込み
        this.questions = await this.db.getAllQuestions();
        
        // 問題がない場合はマークダウンファイルから読み込み
        if (this.questions.length === 0) {
            await this.loadQuestionsFromMarkdown();
            this.questions = await this.db.getAllQuestions();
        }
        
        // 進捗を確認して未正解の問題を特定
        const progress = await this.db.getAllProgress();
        const correctQuestionIds = progress
            .filter(p => p.isCorrect)
            .map(p => p.questionId);
        
        this.incorrectQuestions = this.questions.filter(q => 
            !correctQuestionIds.includes(q.id)
        );
        
        this.correctCount = correctQuestionIds.length;
    }

    async loadQuestionsFromMarkdown() {
        try {
            // questionsフォルダ内のマークダウンファイルリストを取得
            const markdownFiles = await this.getMarkdownFiles();
            
            for (const filename of markdownFiles) {
                try {
                    const response = await fetch(`questions/${filename}`);
                    if (response.ok) {
                        const markdownContent = await response.text();
                        const question = MarkdownParser.parseQuestion(markdownContent);
                        
                        if (question.id && question.title) {
                            await this.db.addQuestion(question);
                            console.log(`問題を追加しました: ${question.title}`);
                        }
                    }
                } catch (error) {
                    console.error(`ファイル ${filename} の読み込みエラー:`, error);
                }
            }
        } catch (error) {
            console.error('マークダウンファイルの読み込みエラー:', error);
            // マークダウンファイルが見つからない場合は空のまま続行
        }
    }

    async getMarkdownFiles() {
        // 既知のマークダウンファイルのリスト
        // 実際のファイルシステムAPIが使えない場合の代替案
        const knownFiles = [
            'iam-basic-concepts.md',
            'ec2-instance-types.md',
            's3-storage-classes.md',
            'ec2-pricing.md',
            'ec2-security-groups.md',
            's3-bucket-policies.md',
            's3-versioning.md',
            'vpc-basics.md',
            'vpc-subnets.md',
            'cloudwatch-basics.md',
            'cloudtrail-basics.md',
            'lambda-basics.md',
            'rds-basics.md'
        ];
        
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
        
        if (this.incorrectQuestions.length === 0) {
            this.showComplete();
            return;
        }
        
        this.elements.quizContainer.style.display = 'block';
        this.currentQuestionIndex = 0;
        this.updateProgress();
        this.showQuestion();
    }

    showQuestion() {
        const question = this.incorrectQuestions[this.currentQuestionIndex];
        
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
        
        const question = this.incorrectQuestions[this.currentQuestionIndex];
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
            // 正解した問題を未正解リストから削除
            this.incorrectQuestions.splice(this.currentQuestionIndex, 1);
            // インデックスを調整
            if (this.currentQuestionIndex >= this.incorrectQuestions.length) {
                this.currentQuestionIndex = 0;
            }
        }
        
        this.updateProgress();
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
        if (this.incorrectQuestions.length === 0) {
            this.showComplete();
            return;
        }
        
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
        const remaining = this.incorrectQuestions.length;
        const current = totalQuestions - remaining + 1;
        
        this.elements.currentQuestion.textContent = Math.min(current, totalQuestions);
        this.elements.totalQuestions.textContent = totalQuestions;
        this.elements.correctCount.textContent = this.correctCount;
    }

    showError(message) {
        this.elements.loading.innerHTML = `<p style="color: red;">エラー: ${message}</p>`;
    }
}

// アプリケーション開始
document.addEventListener('DOMContentLoaded', () => {
    const app = new QuizApp();
    app.init();
});