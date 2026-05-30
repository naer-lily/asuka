import { BrowserWindow } from 'electron'
import type { FormConfig } from '@shared/plugin-api'
import { config } from './config'

function buildFormHtml(cfg: FormConfig, theme: 'light' | 'dark'): string {
  const fieldsHtml = cfg.fields.map(f => buildFieldHtml(f)).join('\n')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
:root{--bg:#202020;--t1:#e8e8e8;--t2:#999;--bd:rgba(255,255,255,0.08);--dv:rgba(255,255,255,0.06);--hv:rgba(255,255,255,0.06);--ib:rgba(255,255,255,0.05);--opt-bg:#2a2a2a;color-scheme:dark}[data-theme="light"]{--bg:#f0f0f0;--t1:#1a1a1a;--t2:#5a5a5a;--bd:rgba(0,0,0,0.1);--dv:rgba(0,0,0,0.07);--hv:rgba(0,0,0,0.05);--ib:rgba(0,0,0,0.04);--opt-bg:#fff;color-scheme:light}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;background:var(--bg);overflow:hidden;user-select:none}
.win{width:100vw;height:100vh;display:flex;flex-direction:column;background:var(--bg);border:1px solid var(--bd);overflow:hidden}
.title-bar{display:flex;align-items:center;justify-content:space-between;padding:0 16px;height:36px;border-bottom:1px solid var(--dv);flex-shrink:0;-webkit-app-region:drag}
.title-bar span{font-size:12px;font-weight:600;color:var(--t1)}
.title-bar button{width:24px;height:24px;border:none;background:none;color:var(--t2);font-size:16px;cursor:pointer;border-radius:4px;line-height:24px;text-align:center;-webkit-app-region:no-drag}
.title-bar button:hover{background:var(--hv);color:var(--t1)}
.body{flex:1;padding:8px 16px;overflow-y:auto;display:flex;flex-direction:column;gap:6px}
.footer{display:flex;justify-content:flex-end;gap:8px;padding:8px 16px;border-top:1px solid var(--dv);flex-shrink:0}
.footer button{padding:6px 20px;border-radius:6px;font-size:13px;cursor:pointer;border:none;font-family:inherit}
.btn-ok{background:#1677ff;color:#fff}
.btn-ok:hover{background:#4096ff}
.btn-cancel{background:var(--hv);color:var(--t1)}
.btn-cancel:hover{background:var(--bd)}
.field{display:flex;flex-direction:column;gap:3px}
.field label{font-size:11px;color:var(--t2)}
.field input,.field select,.field textarea{width:100%;padding:6px 10px;border-radius:6px;border:1px solid var(--bd);background:var(--ib);color:var(--t1);font-size:13px;font-family:inherit;outline:none}
.field input:focus,.field select:focus,.field textarea:focus{border-color:#1677ff}
.field select option{background:var(--opt-bg);color:var(--t1)}
.field textarea{resize:vertical;min-height:60px}
.row{display:flex;gap:8px;flex-wrap:wrap}
.chip{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--t1)}
.chip input[type=checkbox],.chip input[type=radio]{accent-color:#1677ff}
</style></head>
<body>
<div class="win">
<div class="title-bar"><span>${escapeHtml(cfg.title)}</span><button onclick="window.close()">✕</button></div>
<div class="body">${fieldsHtml}</div>
<div class="footer">
<button class="btn-cancel" onclick="window.close()">取消</button>
<button class="btn-ok" onclick="submit()">确定</button>
</div>
</div>
<script>
const { ipcRenderer } = require('electron')
function submit(){
  var vals={}
${cfg.fields.map(f => getterJs(f)).join('\n')}
  ipcRenderer.send('form-submit',vals)
  window.close()
}
</script>
</body></html>`
}

function buildFieldHtml(f: FormConfig['fields'][0]): string {
  const l = escapeHtml(f.label)
  const p = f.placeholder ? escapeHtml(f.placeholder) : ''
  const d = f.disabled ? ' disabled' : ''
  const id = f.key

  switch (f.type) {
    case 'input':
      return `<div class="field"><label>${l}</label><input id="${id}"${d} placeholder="${p}" value="${escapeHtml(String(f.defaultValue ?? ''))}"></div>`
    case 'number':
      return `<div class="field"><label>${l}</label><input type="number" id="${id}"${d} placeholder="${p}" value="${escapeHtml(String(f.defaultValue ?? ''))}"></div>`
    case 'textarea':
      return `<div class="field"><label>${l}</label><textarea id="${id}"${d} placeholder="${p}">${escapeHtml(String(f.defaultValue ?? ''))}</textarea></div>`
    case 'select': {
      const opts = (f.options || []).map(o => {
        const sel = o.value === f.defaultValue ? ' selected' : ''
        return `<option value="${escapeHtml(o.value)}"${sel}>${escapeHtml(o.label)}</option>`
      }).join('')
      return `<div class="field"><label>${l}</label><select id="${id}"${d}>${opts}</select></div>`
    }
    case 'radio': {
      const radios = (f.options || []).map(o => {
        const chk = o.value === f.defaultValue ? ' checked' : ''
        return `<span class="chip"><input type="radio" name="${id}" value="${escapeHtml(o.value)}" id="${id}_${escapeHtml(o.value)}"${chk}${d}><label for="${id}_${escapeHtml(o.value)}">${escapeHtml(o.label)}</label></span>`
      }).join('')
      return `<div class="field"><label>${l}</label><div class="row">${radios}</div></div>`
    }
    case 'checkbox': {
      const defaultVals: string[] = Array.isArray(f.defaultValue) ? f.defaultValue : (f.defaultValue ? [String(f.defaultValue)] : [])
      const boxes = (f.options || []).map(o => {
        const chk = defaultVals.includes(o.value) ? ' checked' : ''
        return `<span class="chip"><input type="checkbox" name="${id}" value="${escapeHtml(o.value)}" id="${id}_${escapeHtml(o.value)}"${chk}${d}><label for="${id}_${escapeHtml(o.value)}">${escapeHtml(o.label)}</label></span>`
      }).join('')
      return `<div class="field"><label>${l}</label><div class="row">${boxes}</div></div>`
    }
    case 'switch':
      return `<div class="field"><label>${l}</label><span class="switch-wrap"><label class="switch"><input type="checkbox" id="${id}"${d}${f.defaultValue ? ' checked' : ''}><span class="slider"></span></label></span></div>`
    default:
      return `<div class="field"><label>${l}</label><input id="${id}"${d} placeholder="${p}"></div>`
  }
}

function getterJs(f: FormConfig['fields'][0]): string {
  const id = f.key

  switch (f.type) {
    case 'input':
    case 'number':
    case 'textarea':
    case 'select':
      return `  vals['${id}']=document.getElementById('${id}').value`
    case 'radio': {
      return `  var r_${id}=document.querySelector('input[name="${id}"]:checked');if(r_${id})vals['${id}']=r_${id}.value`
    }
    case 'checkbox': {
      return `  vals['${id}']=[];var cbs_${id}=document.querySelectorAll('input[name="${id}"]:checked');for(var i=0;i<cbs_${id}.length;i++)vals['${id}'].push(cbs_${id}[i].value)`
    }
    case 'switch':
      return `  vals['${id}']=!!document.getElementById('${id}').checked`
    default:
      return `  vals['${id}']=document.getElementById('${id}')?.value || ''`
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

class FormDialogManager {
  private readonly pending = new Map<number, { resolve: (v: Record<string, unknown> | null) => void; window: BrowserWindow }>()

  async show(formConfig: FormConfig): Promise<Record<string, unknown> | null> {
    const baseWidth = formConfig.width || 400
    const fieldCount = formConfig.fields.length
    const baseHeight = 130 + fieldCount * 48
    const theme = config.get().theme

    const formWindow = new BrowserWindow({
      width: baseWidth,
      height: baseHeight,
      frame: false,
      transparent: false,
      backgroundColor: theme === 'light' ? '#f0f0f0' : '#202020',
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      webPreferences: {
        sandbox: false,
        nodeIntegration: true,
        contextIsolation: false
      }
    })

    const id = formWindow.webContents.id

    return new Promise((resolve) => {
      this.pending.set(id, { resolve, window: formWindow })

      formWindow.on('closed', () => {
        const entry = this.pending.get(id)
        if (entry) {
          entry.resolve(null)
          this.pending.delete(id)
        }
      })

      void formWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildFormHtml(formConfig, theme))}`)
    })
  }

  handleSubmit(webContentsId: number, values: Record<string, unknown>): void {
    const entry = this.pending.get(webContentsId)
    if (entry) {
      entry.resolve(values)
      this.pending.delete(webContentsId)
    }
  }
}

export const formDialog = new FormDialogManager()
