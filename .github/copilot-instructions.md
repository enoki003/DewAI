# DewAI - Copilot Instructions

DewAI is a Tauri desktop application that provides an AI chat interface using local Ollama models. The app combines a React frontend with a Rust backend for seamless AI conversation management.

## Architecture Overview

- **Frontend**: React + TypeScript with Chakra UI v3 and HashRouter
- **Backend**: Rust with Tauri, communicating with local Ollama API (port 11434)
- **AI Model**: Uses `gemma3:4b` model via Ollama REST API
- **State Management**: React hooks with custom `useAIModel` hook for AI operations

## Key Components & Flow

1. **Entry Point**: `src/main.tsx` → Provider setup → HashRouter → App routing
2. **Navigation**: Home (`/`) → Config (`/config`) → Play (`/play`) 
3. **AI Communication**: React → Tauri invoke → Rust backend → Ollama API

### Core Files to Understand

- `src/hooks/useAIModel.tsx`: Manages model loading state and text generation
- `src/components/EnhancedChatAPP.tsx`: Main chat interface with message handling
- `src-tauri/src/main.rs`: Rust backend with Ollama API integration
- `src/pages/config.tsx`: AI personality configuration (name, role, description)

## Development Patterns

### Tauri Commands
All backend functions use `#[command]` decorator and are invoked from React:
```typescript
const response = await invoke<string>('generate_text', { prompt });
```

### AI Model Management
- Check model status with `is_model_loaded()` command
- Uses polling mechanism to wait for Ollama availability
- Handles loading states in UI with status messages

### Chakra UI v3 Usage
- Uses new component naming: `CardRoot`, `FieldRoot`, `NumberInputRoot`
- Custom theme with green color palette
- Provider pattern for global theming and color mode

## Development Workflow

```bash
# Start development (runs both frontend and Tauri)
npm run dev

# Build for production
npm run build

# Tauri-specific commands
npm run tauri dev    # Development mode
npm run tauri build  # Production build
```

## Dependencies & External Services

- **Ollama**: Must be running on `localhost:11434` with `gemma3:4b` model
- **Tauri Plugins**: `tauri-plugin-opener`, `tauri-plugin-sql` (SQLite)
- **HTTP Client**: `reqwest` for Ollama API communication

## Code Conventions

- Japanese UI text throughout the application
- Error messages and logs in Japanese with emoji prefixes
- Async/await pattern for all AI operations
- Component naming: PascalCase with descriptive names
- File organization: pages/, components/, hooks/ structure

## Local AI Integration

The app expects Ollama to be installed and running locally. The Rust backend handles:
- Model availability checking via health endpoint
- Prompt composition for AI personalities
- Streaming response handling (currently disabled with `"stream": false`)

When adding new AI features, follow the pattern of creating Tauri commands in `main.rs` and corresponding hooks in React for state management.
