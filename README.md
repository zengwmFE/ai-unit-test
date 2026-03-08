# AI Unit Test Generator

This small project is meant to produce unit tests for a React frontend by leveraging an OpenAI-compatible API via LangChain.js.

## Usage

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set your API key in the environment:
   ```bash
   export DASHSCOPE_API_KEY="your-key-here"
   ```
3. Run the generator pointing at the React project:
   ```bash
   npm run generate -- ../react-frontend
   ```

The script will scan `src/components/**/*.js` and `src/data/**/*.js` files (excluding `*.test.js`) and ask the model (via LangChain.js) to produce Jest/React Testing Library tests. Generated tests are saved as sibling `*.test.js` files next to the source files.

To speed up generation, files are processed in parallel. You can control concurrency with:

```bash
export GENERATE_CONCURRENCY=5  # default is 3
```
