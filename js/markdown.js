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

        // 画像の処理
        text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
        
        // リンクの処理
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        
        // 改行の処理
        text = text.replace(/\n/g, '<br>');
        
        return text;
    }
}