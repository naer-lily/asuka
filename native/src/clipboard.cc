#include <napi.h>
#include <windows.h>
#include <shellapi.h>
#include <string>
#include <vector>

#pragma comment(lib, "shell32.lib")

namespace {

struct ClipboardContext {
  Napi::ThreadSafeFunction tsfn;
  HWND hwnd;
  bool running;
};

ClipboardContext g_ctx = {nullptr, nullptr, false};

LRESULT CALLBACK ClipboardWndProc(HWND hwnd, UINT msg, WPARAM wParam, LPARAM lParam) {
  if (msg == WM_CLIPBOARDUPDATE && g_ctx.running && g_ctx.tsfn) {
    g_ctx.tsfn.NonBlockingCall();
  }
  return DefWindowProcW(hwnd, msg, wParam, lParam);
}

void InitWindow() {
  if (g_ctx.hwnd) return;

  WNDCLASSEXW wc = {};
  wc.cbSize = sizeof(wc);
  wc.lpfnWndProc = ClipboardWndProc;
  wc.hInstance = GetModuleHandleW(nullptr);
  wc.lpszClassName = L"AsukaClipboardMonitor";
  RegisterClassExW(&wc);

  g_ctx.hwnd = CreateWindowExW(
    0, L"AsukaClipboardMonitor", L"",
    0, 0, 0, 0, 0,
    HWND_MESSAGE, nullptr, GetModuleHandleW(nullptr), nullptr
  );
}

void DestroyWindow() {
  if (g_ctx.hwnd) {
    DestroyWindow(g_ctx.hwnd);
    g_ctx.hwnd = nullptr;
  }
  UnregisterClassW(L"AsukaClipboardMonitor", GetModuleHandleW(nullptr));
}

Napi::Value Start(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1 || !info[0].IsFunction()) {
    Napi::TypeError::New(env, "Expected a callback function").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (g_ctx.running) {
    return env.Undefined();
  }

  InitWindow();

  g_ctx.tsfn = Napi::ThreadSafeFunction::New(
    env,
    info[0].As<Napi::Function>(),
    "ClipboardCallback",
    0,
    1
  );

  AddClipboardFormatListener(g_ctx.hwnd);
  g_ctx.running = true;

  return env.Undefined();
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (!g_ctx.running) return env.Undefined();

  RemoveClipboardFormatListener(g_ctx.hwnd);

  if (g_ctx.tsfn) {
    g_ctx.tsfn.Release();
    g_ctx.tsfn = nullptr;
  }

  DestroyWindow();
  g_ctx.running = false;

  return env.Undefined();
}

Napi::Value GetFilePaths(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  std::vector<std::wstring> files;

  if (OpenClipboard(nullptr)) {
    HANDLE hData = GetClipboardData(CF_HDROP);
    if (hData) {
      HDROP hDrop = static_cast<HDROP>(GlobalLock(hData));
      if (hDrop) {
        UINT count = DragQueryFileW(hDrop, 0xFFFFFFFF, nullptr, 0);
        for (UINT i = 0; i < count; i++) {
          UINT len = DragQueryFileW(hDrop, i, nullptr, 0);
          if (len == 0) continue;
          std::vector<wchar_t> buf(len + 1);
          DragQueryFileW(hDrop, i, buf.data(), static_cast<UINT>(buf.size()));
          files.push_back(std::wstring(buf.data(), len));
        }
        GlobalUnlock(hData);
      }
    }
    CloseClipboard();
  }

  Napi::Array result = Napi::Array::New(env, files.size());
  for (size_t i = 0; i < files.size(); i++) {
    int utf8Len = WideCharToMultiByte(
      CP_UTF8, 0, files[i].c_str(), -1, nullptr, 0, nullptr, nullptr
    );
    if (utf8Len > 0) {
      std::string utf8(utf8Len - 1, '\0');
      WideCharToMultiByte(
        CP_UTF8, 0, files[i].c_str(), -1, &utf8[0], utf8Len, nullptr, nullptr
      );
      result[i] = Napi::String::New(env, utf8);
    }
  }

  return result;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("start", Napi::Function::New(env, Start));
  exports.Set("stop", Napi::Function::New(env, Stop));
  exports.Set("getFilePaths", Napi::Function::New(env, GetFilePaths));
  return exports;
}

} // namespace

NODE_API_MODULE(clipboard_native, Init)
