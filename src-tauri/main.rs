use tokio::sync::Mutex;
use candle::{Device};
use candle::quantized::gguf::{GguFModel, generate};
use tauri::{command};
use once_cell::sync::Lazy;
use std::env;

// グローバルモデルの非同期ロック
static MODEL: Lazy<Mutex<Option<GguFModel>>> = Lazy::new(|| Mutex::new(None));

// モデルをロードする関数
async fn load_model() -> anyhow::Result<()> {
    let device = Device::cuda_if_available(0).unwrap_or(Device::Cpu);

    // 環境変数からモデルパスを取得（デフォルト値あり）
    let model_path = env::var("MODEL_PATH").unwrap_or_else(|_| "./models/gemma-3-4b-it-Q4_K_M.gguf".to_string());

    // モデルのロード
    let model = GguFModel::load(&model_path, &device)?;

    // グローバルモデルにセット
    let mut model_lock = MODEL.lock().await;
    *model_lock = Some(model);
    Ok(())
}

// テキスト生成コマンド
#[command]
async fn generate_text(prompt: String) -> Result<String, String> {
    let model_lock = MODEL.lock().await;
    let model = model_lock.as_ref().ok_or("Model not loaded")?;

    match generate(model, &prompt, 50, 0.7, 0.95, None) {
        Ok(output) => Ok(output),
        Err(e) => Err(e.to_string()),
    }
}

// メイン関数
#[tokio::main]
async fn main() {
    // モデルのロード
    match load_model().await {
        Ok(_) => println!("Model loaded successfully."),
        Err(e) => {
            eprintln!("Failed to load model: {}", e);
            return;
        }
    }

    // Tauriアプリケーションの起動
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![generate_text])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
