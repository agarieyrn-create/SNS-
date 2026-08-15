# AI接続設定ガイド

SNS Growth Copilotでは、**OpenAI、Claude、Gemini、OpenRouter**のAPIキーをアプリ内の「設定」画面から登録できます。登録したキーは画面に再表示されず、サーバー側で暗号化して保存されます。

## 設定手順

1. アプリのサイドバーから **設定** を開きます。
2. 下部の **AI接続と優先順位** で使いたいプロバイダーを選びます。
3. APIキーとモデルIDを入力し、**この接続を有効にする** を選んで登録します。
4. 複数登録した場合は、上下ボタンで優先順位を設定します。生成・AI改善時は上から順に呼び出し、失敗時は次の有効なプロバイダーへ切り替わります。

| プロバイダー | APIキーの取得先 | モデルIDの例 |
|---|---|---|
| OpenAI | OpenAI Platform | `gpt-5-mini` |
| Claude | Anthropic Console | `claude-sonnet-4-6` |
| Gemini | Google AI Studio | `gemini-3.6-flash` |
| OpenRouter | OpenRouter | `openai/gpt-5-mini` |

## ChatGPTサブスクリプションとの違い

> **ChatGPT Plus／Proなどのサブスクリプションは、外部アプリからOpenAI APIを呼び出す権利やAPIキーを含みません。**

OpenAIはChatGPTとAPIを別の請求・管理体系として扱っています。OpenAIを優先接続にする場合は、ChatGPTの契約とは別にOpenAI PlatformでAPIキーを作成し、API側の利用設定を行ってください。[1] [2]

APIキーを登録しない、またはすべての外部接続を無効にした場合は、従来のアプリ内蔵AIが投稿案生成とAI改善に使われます。

## セキュリティ設計

APIキーは、ブラウザに再表示せず、暗号化してデータベースへ保存します。投稿案生成またはAI改善を実行する時だけ、サーバー内で復号して該当プロバイダーへ送信します。キーを削除すると、以後そのプロバイダーは使用できません。

## 参照

[1]: https://help.openai.com/en/articles/8156019-how-can-i-move-my-chatgpt-subscription-to-the-api "OpenAI Help — ChatGPTサブスクリプションとAPIの分離"
[2]: https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus "OpenAI Help — ChatGPT Plusの対象外：API利用"
