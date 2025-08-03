# DewAI License

## Main Project License

**ISC License**

Copyright (c) 2025 DewAI Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

## Third-Party Dependencies

This project includes and/or depends on the following third-party libraries and tools:

### Frontend Dependencies (JavaScript/TypeScript)

#### React Ecosystem
- **React** (MIT License) - Copyright (c) Facebook, Inc. and its affiliates
- **React DOM** (MIT License) - Copyright (c) Facebook, Inc. and its affiliates
- **React Router DOM** (MIT License) - Copyright (c) Remix Software Inc.

#### UI Framework
- **Chakra UI** (MIT License) - Copyright (c) 2019 Segun Adebayo
  - @chakra-ui/react
  - @chakra-ui/card
  - @chakra-ui/checkbox
  - @chakra-ui/form-control
  - @chakra-ui/icons
  - @chakra-ui/layout
  - @chakra-ui/number-input

#### Tauri Integration
- **@tauri-apps/api** (Apache-2.0 OR MIT License) - Copyright (c) 2019-2023 Tauri Programme within The Commons Conservancy
- **@tauri-apps/plugin-opener** (Apache-2.0 OR MIT License)
- **@tauri-apps/plugin-sql** (Apache-2.0 OR MIT License)

#### Animation and Styling
- **Framer Motion** (MIT License) - Copyright (c) 2018 Framer B.V.
- **Emotion** (MIT License) - Copyright (c) Emotion team and other contributors
  - @emotion/react
  - @emotion/styled

#### Utilities
- **React Icons** (MIT License) - Copyright (c) 2018 Kamran Ahmed
- **next-themes** (MIT License) - Copyright (c) 2020 Paco Coursey

#### Development Tools
- **Vite** (MIT License) - Copyright (c) 2019-present, Yuxi (Evan) You and Vite contributors
- **TypeScript** (Apache-2.0 License) - Copyright (c) Microsoft Corporation
- **@vitejs/plugin-react** (MIT License)
- **Autoprefixer** (MIT License) - Copyright 2013 Andrey Sitnik
- **PostCSS** (MIT License) - Copyright 2013 Andrey Sitnik

### Backend Dependencies (Rust)

#### Core Framework
- **Tauri** (Apache-2.0 OR MIT License) - Copyright (c) 2019-2023 Tauri Programme within The Commons Conservancy
- **tauri-build** (Apache-2.0 OR MIT License)
- **tauri-plugin-opener** (Apache-2.0 OR MIT License)
- **tauri-plugin-sql** (Apache-2.0 OR MIT License)

#### Serialization
- **Serde** (Apache-2.0 OR MIT License) - Copyright (c) 2014 Erick Tryzelaar and David Tolnay
- **serde_json** (Apache-2.0 OR MIT License) - Copyright (c) 2016 Erick Tryzelaar and David Tolnay

#### HTTP Client
- **reqwest** (Apache-2.0 OR MIT License) - Copyright (c) 2016 Sean McArthur

#### Async Runtime
- **Tokio** (MIT License) - Copyright (c) 2019 Tokio Contributors

#### Error Handling
- **anyhow** (Apache-2.0 OR MIT License) - Copyright (c) David Tolnay

#### Date/Time
- **chrono** (Apache-2.0 OR MIT License) - Copyright (c) 2014 Kang Seonghoon and contributors

---

## AI Integration

This project integrates with **Ollama**, an open-source tool for running large language models locally:

- **Ollama** (MIT License) - Copyright (c) Ollama contributors
  - Used for local AI model inference via REST API
  - Default model: `gemma3:4b` (subject to Google's Gemma license terms)

---

## License Compatibility

All included dependencies are compatible with the ISC license under which this project is distributed. The combination of MIT, Apache-2.0, and ISC licenses allows for:

- Commercial and non-commercial use
- Modification and distribution
- Private use
- Patent protection (where applicable via Apache-2.0 components)

## Model License Notice

When using AI models through Ollama (such as `gemma3:4b`), please ensure compliance with the respective model licenses. Different models may have different licensing terms:

- **Gemma models**: Subject to Google's Gemma Terms of Use
- **Llama models**: Subject to Meta's custom license
- **Other models**: Check individual model documentation

---

## Contributing

By contributing to this project, you agree that your contributions will be licensed under the same ISC license that covers this project.

## Disclaimer

This software is provided "AS IS" without warranty of any kind. The authors and contributors are not liable for any damages arising from the use of this software.

For detailed license terms of individual dependencies, please refer to their respective repositories and documentation.

---

*Last updated: 2025年8月3日*
