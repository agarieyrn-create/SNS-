# X予約投稿の設定ガイド

SNS Growth Copilotは、登録した**自分のX API認証情報**を使い、指定日時の投稿を自動実行します。アプリはXの投稿作成エンドポイント `POST /2/tweets` を利用し、予約時刻になるとサーバー側の予約ワーカーが投稿します。[1]

## 事前準備

X Developer ConsoleでDeveloper AccountとAppを作成し、App Permissionsを**Read and write**に設定してください。本人のアカウントとして投稿する方式では、次の4項目が必要です。[2]

| 設定画面の入力欄 | X Developer Consoleの名称 | 用途 |
|---|---|---|
| API Key | API Key | Xアプリを識別します。 |
| API Key Secret | API Key Secret | OAuth 1.0aリクエストを署名します。 |
| Access Token | Access Token | あなたのXアカウントとして投稿します。 |
| Access Token Secret | Access Token Secret | アクセストークンと組み合わせてリクエストを署名します。 |

> **Bearer Tokenだけでは予約投稿できません。** Bearer Tokenはアプリ単位の主に読み取り用認証であり、本人として投稿するにはユーザー権限のOAuthまたはAccess Token／Secretが必要です。[2] [3]

## アプリ内の設定手順

1. 本アプリを公開後、**設定**画面の「X自動投稿の認証」を開きます。
2. 4つの認証情報を入力し、**認証情報を登録**を選びます。情報は再表示せず、サーバー側で暗号化して保存します。
3. **接続をテスト**を選び、成功状態を確認します。失敗時はX Developer Consoleの権限、トークン再生成、App設定を確認してください。
4. **投稿案**で内容を確認し、**Xへ予約**から日時を指定します。
5. 設定画面の「X投稿の予約一覧」で、編集・取消・失敗時の再試行・送信履歴を確認します。

## 運用上の注意

予約投稿は1分ごとに送信対象を確認します。したがって、指定時刻から最大1分程度の実行誤差がありえます。投稿開始後は重複送信を防ぐために状態を原子的に更新し、成功・失敗の実行履歴を残します。

投稿本文はこの初期版では**280文字以内のテキスト投稿**に限定しています。画像、動画、スレッド、アンケートは今後の拡張対象です。投稿済みのX投稿は、本アプリから取消・削除しません。X上の投稿を削除する必要がある場合は、XアプリまたはXの投稿管理で操作してください。

## 参照

[1]: https://docs.x.com/x-api/posts/manage-tweets/quickstart "X API v2 — Create a Post"
[2]: https://docs.x.com/x-api/getting-started/getting-access "X Developer Platform — Getting Access"
[3]: https://docs.x.com/fundamentals/authentication/oauth-2-0/overview "X Developer Platform — OAuth 2.0 Overview"
