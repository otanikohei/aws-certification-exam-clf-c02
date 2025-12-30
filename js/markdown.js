class MarkdownParser {
    static parseQuestion(markdown) {
        const lines = markdown.split('\n');
        const question = {
            id: null,
            title: '',
            content: '',
            choices: [],
            correctAnswer: null,      // 単一選択用（後方互換性）
            correctAnswers: [],       // 複数選択用
            isMultipleChoice: false,  // 複数選択問題かどうか
            explanation: ''
        };

        let currentSection = 'content'; // タイトル後は問題文から開始
        let contentLines = [];
        let explanationLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // タイトル（# で始まる行）
            if (trimmedLine.startsWith('# ') && !trimmedLine.startsWith('## ')) {
                question.title = trimmedLine.substring(2).trim();
                question.id = this.generateId(question.title);
                currentSection = 'content';
                continue;
            }

            // 正解セクション
            if (trimmedLine === '## 正解') {
                currentSection = 'answer';
                continue;
            }

            // 解説セクション
            if (trimmedLine === '## 解説') {
                currentSection = 'explanation';
                continue;
            }

            // 選択肢の検出（- A), - B), - C), - D), - E) 形式）
            const choiceMatch = trimmedLine.match(/^- ([A-E])\)\s*(.+)$/);
            if (choiceMatch && currentSection === 'content') {
                // 選択肢の前までを問題文として保存
                if (question.content === '' && contentLines.length > 0) {
                    question.content = contentLines.join('\n').trim();
                    contentLines = [];
                }
                question.choices.push(choiceMatch[2]);
                continue;
            }

            // 正解の検出
            if (currentSection === 'answer') {
                // 複数選択: **B** と **E** 形式
                const multiAnswerMatch = trimmedLine.match(/\*\*([A-E])\*\*/g);
                if (multiAnswerMatch && multiAnswerMatch.length > 1) {
                    question.isMultipleChoice = true;
                    question.correctAnswers = multiAnswerMatch.map(match => {
                        const letter = match.replace(/\*/g, '');
                        return letter.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
                    });
                } else if (multiAnswerMatch && multiAnswerMatch.length === 1) {
                    // 単一選択: **A** 形式
                    const letter = multiAnswerMatch[0].replace(/\*/g, '');
                    question.correctAnswer = letter.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
                    question.correctAnswers = [question.correctAnswer];
                }
                continue;
            }

            // 解説セクションの内容を収集
            if (currentSection === 'explanation') {
                explanationLines.push(line);
                continue;
            }

            // 問題文の収集
            if (currentSection === 'content' && question.choices.length === 0) {
                contentLines.push(line);
            }
        }

        // 問題文が設定されていない場合
        if (question.content === '' && contentLines.length > 0) {
            question.content = contentLines.join('\n').trim();
        }

        // 解説を設定
        if (explanationLines.length > 0) {
            question.explanation = explanationLines.join('\n').trim();
        }

        return question;
    }

    static parseChoices(lines, question) {
        for (const line of lines) {
            const trimmed = line.trim();
            // 数字形式（1. ）または A) 形式に対応
            if (trimmed.match(/^\d+\.\s/)) {
                const choiceText = trimmed.substring(trimmed.indexOf('.') + 1).trim();
                question.choices.push(choiceText);
            } else if (trimmed.match(/^[A-D]\)\s/)) {
                const choiceText = trimmed.substring(trimmed.indexOf(')') + 1).trim();
                question.choices.push(choiceText);
            }
        }
    }

    static generateId(title) {
        return title.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
    }

    static renderMarkdown(text) {
        if (!text) return '';

        // コードブロックの処理（```で囲まれた部分）
        text = text.replace(/```([^`]*?)```/gs, '<pre><code>$1</code></pre>');
        
        // インラインコードの処理（`で囲まれた部分）
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // 見出しの処理（### → h5, ## → h4 など）
        text = text.replace(/^#### (.+)$/gm, '<h6>$1</h6>');
        text = text.replace(/^### (.+)$/gm, '<h5>$1</h5>');
        text = text.replace(/^## (.+)$/gm, '<h4>$1</h4>');
        
        // 太字の処理（**text** または __text__）
        text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        
        // 斜体の処理（*text* または _text_）
        text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
        
        // 画像の処理
        text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
        
        // リンクの処理
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        
        // リストの処理（- で始まる行）
        text = text.replace(/^- (.+)$/gm, '<li>$1</li>');
        text = text.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
        
        // 番号付きリストの処理
        text = text.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
        
        // 水平線の処理
        text = text.replace(/^---$/gm, '<hr>');
        
        // 改行の処理（連続する改行は段落として扱う）
        text = text.replace(/\n\n/g, '</p><p>');
        text = text.replace(/\n/g, '<br>');
        
        // 段落で囲む
        if (!text.startsWith('<')) {
            text = '<p>' + text + '</p>';
        }
        
        return text;
    }
}