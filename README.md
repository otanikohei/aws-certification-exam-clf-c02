# AWS プラクティショナー問題集アプリ

AWS Cloud Practitioner試験対策用のPWA（Progressive Web App）問題集アプリです。

## 🚀 デモ

GitHub Pagesでホスティング予定：`https://[ユーザー名].github.io/[リポジトリ名]/`

## ✨ 機能

- **一問一答形式**：選択肢から回答を選んで学習
- **進捗管理**：正解数と残り問題数を表示
- **間違えた問題の再出題**：正解するまで繰り返し学習
- **オフライン対応**：PWAによりオフラインでも利用可能
- **レスポンシブデザイン**：iPhone Safariに最適化
- **マークダウン対応**：問題と解説で画像・リンクが使用可能

## 📱 対応デバイス

- iPhone Safari（メイン対象）
- その他のモダンブラウザ

## 🛠️ 技術スタック

- **フロントエンド**：HTML5, CSS3, Vanilla JavaScript
- **データベース**：IndexedDB（ローカルストレージ）
- **PWA**：Service Worker, Web App Manifest
- **問題形式**：Markdown

## 📝 問題の追加方法

1. `questions/` フォルダに新しい `.md` ファイルを作成
2. 以下の形式で問題を記述：

```markdown
# 問題タイトル

## 問題
ここに問題文を入力してください。

## 選択肢
1. 選択肢1
2. 選択肢2
3. 選択肢3
4. 選択肢4

## 正解
2

## 解説
ここに解説を入力してください。
```

## 📁 ファイル命名規則

- `{サービス名}-{具体的な機能}.md`
- 例：
  - `ec2-instance-types.md`
  - `s3-storage-classes.md`
  - `iam-basic-concepts.md`

## 🚀 GitHub Pagesでのデプロイ方法

1. GitHubリポジトリを作成
2. ファイルをプッシュ
3. Settings > Pages > Source を "Deploy from a branch" に設定
4. Branch を "main" に設定
5. 数分後に `https://[ユーザー名].github.io/[リポジトリ名]/` でアクセス可能

## 📂 プロジェクト構造

```
aws-practitioner-quiz/
├── index.html          # メインHTML
├── manifest.json       # PWA設定
├── sw.js              # Service Worker
├── css/
│   └── style.css      # スタイル
├── js/
│   ├── app.js         # メインアプリケーション
│   ├── database.js    # IndexedDB管理
│   └── markdown.js    # マークダウンパーサー
├── questions/         # 問題ファイル（マークダウン）
│   ├── iam-basic-concepts.md
│   ├── ec2-instance-types.md
│   └── s3-storage-classes.md
└── icons/            # PWAアイコン（今後追加予定）
```

## 🎯 今後の予定

- [ ] PWAアイコンの追加
- [ ] 問題カテゴリ別の分類
- [ ] 学習進捗の統計表示
- [ ] ダークモード対応

## 📄 ライセンス

MIT License