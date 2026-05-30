{
  "targets": [
    {
      "target_name": "clipboard_native",
      "sources": ["src/clipboard.cc"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "libraries": ["shell32.lib"],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 0,
          "AdditionalOptions": ["/utf-8"]
        }
      }
    }
  ]
}
