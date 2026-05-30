<template>
  <div class="settings">
    <h2>Asuka 设置</h2>

    <div class="section">
      <label class="section-title">主题</label>
      <select v-model="theme" @change="onSave">
        <option value="dark">暗色</option>
        <option value="light">亮色</option>
      </select>
    </div>

    <div class="section">
      <label class="checkbox-label">
        <input type="checkbox" v-model="launchAtStartup" @change="onSave" />
        开机自启
      </label>
    </div>

    <div class="section">
      <label class="section-title">悬浮球位置</label>
      <p class="hint">拖动悬浮球后位置自动保存，可在托盘菜单中重置</p>
      <div class="pos-row">
        <span>X: {{ bubbleX }}</span>
        <span>Y: {{ bubbleY }}</span>
      </div>
    </div>

    <div class="section">
      <label class="section-title">插件</label>
      <div v-for="plugin in plugins" :key="plugin.id" class="plugin-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="enabledPlugins.includes(plugin.id)"
            @change="onTogglePlugin(plugin.id, ($event.target as HTMLInputElement).checked)"
          />
          <span class="plugin-icon">{{ plugin.icon }}</span>
          <span>{{ plugin.name }}</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface PluginInfo {
  id: string
  name: string
  icon: string
}

const theme = ref('dark')
const launchAtStartup = ref(false)
const bubbleX = ref(0)
const bubbleY = ref(0)
const plugins = ref<PluginInfo[]>([])
const enabledPlugins = ref<string[]>([])

const settingsAPI = (window as any).settingsAPI

function onSave(): void {
  settingsAPI.saveConfig({
    theme: theme.value,
    launchAtStartup: launchAtStartup.value
  })
}

function onTogglePlugin(pluginId: string, enabled: boolean): void {
  if (enabled) {
    if (!enabledPlugins.value.includes(pluginId)) {
      enabledPlugins.value.push(pluginId)
    }
  } else {
    enabledPlugins.value = enabledPlugins.value.filter((id: string) => id !== pluginId)
  }
  settingsAPI.saveConfig({
    enabledPlugins: enabledPlugins.value
  })
}

onMounted(() => {
  const cleanup = settingsAPI.onInit((data: any) => {
    theme.value = data.config.theme || 'dark'
    launchAtStartup.value = data.config.launchAtStartup || false
    bubbleX.value = data.config.bubbleX || 0
    bubbleY.value = data.config.bubbleY || 0
    plugins.value = data.plugins || []
    enabledPlugins.value = data.config.enabledPlugins || []
  })
})
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.settings {
  padding: 24px;
  font-family: -apple-system, "Microsoft YaHei", sans-serif;
  font-size: 14px;
  color: #e0e0e0;
  background: #1e1e1e;
  min-height: 100vh;
}

h2 {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #fff;
}

.section {
  margin-bottom: 20px;
}

.section-title {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #aaa;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 0;
}

select {
  padding: 6px 12px;
  background: #2d2d2d;
  color: #e0e0e0;
  border: 1px solid #444;
  border-radius: 4px;
  font-size: 14px;
}

.hint {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #888;
}

.pos-row {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #aaa;
}

.plugin-row {
  margin: 4px 0;
}

.plugin-icon {
  font-size: 16px;
}

input[type="checkbox"] {
  accent-color: #569cd6;
}
</style>
