class MarkdownParser {
    static parseQuestion(markdown) {
        const lines = markdown.split('\n');
        const question = {
            id: null,
            title: '',
            content: '',
            choices: [],
            correctAnswer: null,
            explanation: ''
        };

        let currentSection = '';
        let contentLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('# ')) {
                question.title = line.substring(2).trim();
                question.id = this.generateId(question.title);
            } else if (line === '## 問題') {
                currentSection = 'question';
                contentLines = [];
            } else if (line === '## 選択肢') {
                if (currentSection === 'question') {
                    question.content = contentLines.join('\n').trim();
                }
                currentSection = 'choices';
                contentLines = [];
            } else if (line === '## 正解') {
                if (currentSection === 'choices') {
                    this.parseChoices(contentLines, question);
                }
                currentSection = 'answer';
                contentLines = [];
            } else if (line === '## 解説') {
                if (currentSection === 'answer') {
                    const answerLine = contentLines.find(l => l.trim() !== '');
                    if (answerLine) {
                        question.correctAnswer = parseInt(answerLine.trim());
                    }
                }
                currentSection = 'explanation';
                contentLines = [];
            } else if (line !== '') {
                contentLines.push(line);
            }
        }

        // 最後のセクション（解説）を処理
        if (currentSection === 'explanation') {
            question.explanation = contentLines.join('\n').trim();
        }

        return question;
    }

    static parseChoices(lines, question) {
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.match(/^\d+\.\s/)) {
                const choiceText = trimmed.substring(trimmed.indexOf('.') + 1).trim();
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