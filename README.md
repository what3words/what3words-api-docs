# what3words API Docs

Welcome to the official documentation repository for the **what3words API**. This repository hosts the OpenAPI specifications, developer resources, and LLM-friendly metadata for integrating what3words location technology into your applications.

## 🔍 About

what3words provides a simple way to communicate precise locations using unique three-word addresses. This repository includes API references, SDK guides, OpenAPI specifications, Postman collections, and resources for integrating with LLMs (Large Language Models).

## 🚀 Live OpenAPI Documentation

Explore the live interactive OpenAPI documentation here:  
👉 **[https://openapi.what3words.com/openapi/openapi.yaml](https://openapi.what3words.com/openapi/openapi.yaml)**

## 📂 Repository Structure

The repository is organised as follows:

- **docs/**  
  Main documentation folder, including:
  - `index.html`: "OpenAPI & AI resources" home page: files, endpoints, authentication and errors
  - `llms.txt`, `llms-full.txt`: LLM-friendly metadata for AI tools
  - `openapi/`: OpenAPI specifications (`openapi.yaml`, `openapi.json`) and the endpoint browser (`index.html`)
  - `what3words.postman_collection.json`: Postman collection for API testing
  - `assets/`: shared `site.css` and `site.js`, plus what3words brand assets in `assets/brand/`

### Site pages

- Both pages share `assets/site.css` and `assets/site.js`; there is no build step.
- The what3words header and footer come from the corporate site shell. The blocks between the `shell:top` and `shell:bottom` comments must stay identical in `index.html` and `openapi/index.html`.
- The endpoint browser reads `openapi/openapi.json` in the browser, so spec changes appear without editing HTML. Endpoint groups in the sidebar are set by `GROUPS` in `assets/site.js`; new paths appear under "Endpoints" until added there.
- To show a "Last updated" date, set `info.x-last-updated` (`YYYY-MM-DD`) in the spec. HTTP `Last-Modified` is not used because GitHub Pages stamps every file with the deploy time.

## 📚 Key Resources

- [what3words Developer Site](https://developer.what3words.com)
- [OpenAPI & AI resources](https://openapi.what3words.com/)
- [OpenAPI definition (YAML)](https://openapi.what3words.com/openapi/openapi.yaml)
- [Postman Collection](https://openapi.what3words.com/what3words.postman_collection.json)
- [GitHub Repositories](https://github.com/what3words)

## ⚙️ Usage

- Browse the documentation in the `docs/` folder or open `docs/index.html` in your browser.
- Use the OpenAPI specs and Postman collection for API integration and testing.
- Reference `llms.txt` and `llms-full.txt` for LLM and AI tool onboarding.

## 🤝 Contributing

This repository is maintained by the what3words Developer Team. For suggestions or issues, please contact [support@what3words.com](mailto:support@what3words.com).

## 📜 License

See [what3words Developer Terms of Service](https://developer.what3words.com/terms-of-service) for usage guidelines.
