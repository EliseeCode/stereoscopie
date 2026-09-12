<script setup>
import { OBJECTS } from '../lib/objects.js'
import { PATTERNS } from '../lib/patterns.js'

const objectId = defineModel('objectId', { type: String })
const text = defineModel('text', { type: String })
const patternId = defineModel('patternId', { type: String })
const tileWidth = defineModel('tileWidth', { type: Number })
const autoTile = defineModel('autoTile', { type: Boolean })

const depthStrength = defineModel('depthStrength', { type: Number })
const crossEyed = defineModel('crossEyed', { type: Boolean })
const autoRotate = defineModel('autoRotate', { type: Boolean })

const props = defineProps({
  hasUpload: { type: Boolean, default: false },
  tilePreview: { type: String, default: '' },
  tileMm: { type: Number, default: 0 },
})

const emit = defineEmits(['regenerate', 'upload'])

function onFile(e) {
  const file = e.target.files?.[0]
  if (file) emit('upload', file)
  e.target.value = ''
}
</script>

<template>
  <aside class="panel">
    <section>
      <h2>3D object</h2>
      <label class="field">
        <span>Shape</span>
        <select v-model="objectId">
          <option v-for="o in OBJECTS" :key="o.id" :value="o.id">{{ o.label }}</option>
        </select>
      </label>
      <label v-if="objectId === 'text'" class="field">
        <span>Text</span>
        <input v-model="text" type="text" maxlength="40" placeholder="HELLO" spellcheck="false" />
      </label>
      <label class="field row">
        <input v-model="autoRotate" type="checkbox" />
        <span>Auto-rotate</span>
      </label>
      <p class="help">Drag the preview or the stereogram to orbit, scroll to zoom.</p>
    </section>

    <section>
      <h2>Pattern</h2>
      <label class="field">
        <span>Texture</span>
        <select v-model="patternId">
          <option v-for="p in PATTERNS" :key="p.id" :value="p.id">{{ p.label }}</option>
          <option value="upload" :disabled="!hasUpload">Your image</option>
        </select>
      </label>
      <div class="tile-row">
        <img v-if="tilePreview" :src="tilePreview" class="tile-preview" alt="pattern tile" />
        <div class="tile-actions">
          <button class="btn" @click="emit('regenerate')">New seed</button>
          <label class="btn file">
            Upload image
            <input type="file" accept="image/*" @change="onFile" />
          </label>
        </div>
      </div>
      <label class="field row">
        <input v-model="autoTile" type="checkbox" />
        <span>Auto tile width (65 mm eye spacing at 96 dpi)</span>
      </label>
      <label class="field">
        <span>Tile width <b>{{ tileWidth }} px</b> · {{ tileMm.toFixed(1) }} mm on screen</span>
        <input v-model.number="tileWidth" type="range" min="20" max="300" step="1" :disabled="autoTile" />
      </label>
    </section>


    <section>
      <h2>Stereogram</h2>
      <label class="field">
        <span>Depth strength <b>{{ depthStrength.toFixed(2) }}</b></span>
        <input v-model.number="depthStrength" type="range" min="0.1" max="0.6" step="0.01" />
      </label>
      <label class="field row">
        <input v-model="crossEyed" type="checkbox" />
        <span>Cross-eyed viewing</span>
      </label>
    </section>

  </aside>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.title {
  font-size: 22px;
  margin: 0;
  letter-spacing: 0.02em;
}
.subtitle {
  margin: -12px 0 0;
  color: var(--muted);
  font-size: 13px;
}
section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 10px;
  background: var(--panel);
}
h2 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin: 0;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
.field.row {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.field b {
  font-weight: 600;
  color: var(--accent);
}
.help {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}
.tile-row {
  display: flex;
  gap: 10px;
  align-items: center;
}
.tile-preview {
  width: 64px;
  height: 64px;
  border-radius: 6px;
  image-rendering: pixelated;
  border: 1px solid var(--border);
}
.tile-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.btn.file input {
  display: none;
}
input[type='text'] {
  background: #0e1015;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 8px;
  font: inherit;
  width: 100%;
}


</style>
