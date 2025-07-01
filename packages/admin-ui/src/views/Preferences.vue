<template>
  <div class="preferences-view">
    <div class="preferences-header">
      <h1>Preferences</h1>
      <p>Customize your news experience and bias detection settings</p>
    </div>

    <div class="preferences-content">
      <!-- News Display Preferences -->
      <div class="preference-card">
        <h2>News Display</h2>
        
        <div class="preference-group">
          <label class="preference-label">
            <input
              type="checkbox"
              v-model="preferences.showAllPerspectives"
              class="preference-checkbox"
            />
            Show all political perspectives
          </label>
          <p class="preference-description">
            Display articles from left, center, and right-leaning sources for each story
          </p>
        </div>

        <div class="preference-group">
          <label class="preference-label">
            <input
              type="checkbox"
              v-model="preferences.highlightBlindspots"
              class="preference-checkbox"
            />
            Highlight bias blindspots
          </label>
          <p class="preference-description">
            Emphasize stories where you might be missing important perspectives
          </p>
        </div>

        <div class="preference-group">
          <label class="preference-label">
            <input
              type="checkbox"
              v-model="preferences.showCoverageScores"
              class="preference-checkbox"
            />
            Show coverage scores
          </label>
          <p class="preference-description">
            Display how well each story is covered across different sources
          </p>
        </div>
      </div>

      <!-- Bias Detection Settings -->
      <div class="preference-card">
        <h2>Bias Detection</h2>
        
        <div class="preference-group">
          <label class="preference-label">Sensitivity Level</label>
          <select v-model="preferences.biasSensitivity" class="preference-select">
            <option value="low">Low - Only flag obvious bias</option>
            <option value="medium">Medium - Standard detection</option>
            <option value="high">High - Detect subtle bias</option>
          </select>
          <p class="preference-description">
            Controls how sensitive the AI bias detection should be
          </p>
        </div>

        <div class="preference-group">
          <label class="preference-label">
            <input
              type="checkbox"
              v-model="preferences.autoAnalyzeReading"
              class="preference-checkbox"
            />
            Auto-analyze articles I read
          </label>
          <p class="preference-description">
            Automatically run bias analysis on articles you click to read
          </p>
        </div>

        <div class="preference-group">
          <label class="preference-label">
            <input
              type="checkbox"
              v-model="preferences.showAnalysisDetails"
              class="preference-checkbox"
            />
            Show detailed analysis
          </label>
          <p class="preference-description">
            Display technical details about bias scores and reasoning
          </p>
        </div>
      </div>

      <!-- Notification Preferences -->
      <div class="preference-card">
        <h2>Notifications</h2>
        
        <div class="preference-group">
          <label class="preference-label">
            <input
              type="checkbox"
              v-model="preferences.notifyBlindspots"
              class="preference-checkbox"
            />
            Blindspot alerts
          </label>
          <p class="preference-description">
            Get notified when new bias blindspots are detected
          </p>
        </div>

        <div class="preference-group">
          <label class="preference-label">
            <input
              type="checkbox"
              v-model="preferences.notifyBreaking"
              class="preference-checkbox"
            />
            Breaking news alerts
          </label>
          <p class="preference-description">
            Receive notifications for major breaking news stories
          </p>
        </div>

        <div class="preference-group">
          <label class="preference-label">Notification Frequency</label>
          <select v-model="preferences.notificationFrequency" class="preference-select">
            <option value="immediate">Immediate</option>
            <option value="hourly">Hourly digest</option>
            <option value="daily">Daily digest</option>
            <option value="weekly">Weekly digest</option>
          </select>
        </div>
      </div>

      <!-- Source Preferences -->
      <div class="preference-card">
        <h2>Source Preferences</h2>
        
        <div class="preference-group">
          <label class="preference-label">Preferred Sources</label>
          <div class="source-list">
            <label 
              v-for="source in availableSources" 
              :key="source.id"
              class="source-checkbox-label"
            >
              <input
                type="checkbox"
                :value="source.id"
                v-model="preferences.preferredSources"
                class="preference-checkbox"
              />
              <span class="source-name">{{ source.name }}</span>
              <span class="source-bias" :class="`bias-${source.bias}`">
                {{ getBiasLabel(source.bias) }}
              </span>
            </label>
          </div>
        </div>

        <div class="preference-group">
          <label class="preference-label">
            <input
              type="checkbox"
              v-model="preferences.excludeUnknownSources"
              class="preference-checkbox"
            />
            Exclude sources with unknown bias
          </label>
          <p class="preference-description">
            Hide articles from sources that haven't been bias-rated yet
          </p>
        </div>
      </div>

      <!-- Save Button -->
      <div class="save-section">
        <button 
          @click="savePreferences" 
          :disabled="saving"
          class="save-button"
        >
          {{ saving ? 'Saving...' : 'Save Preferences' }}
        </button>
        
        <button 
          @click="resetToDefaults" 
          class="reset-button"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useApi } from '@/composables/useApi'

const { updatePreferences } = useAuth()
const { get } = useApi()

const saving = ref(false)
const availableSources = ref([])

const preferences = ref({
  // News Display
  showAllPerspectives: true,
  highlightBlindspots: true,
  showCoverageScores: true,
  
  // Bias Detection
  biasSensitivity: 'medium',
  autoAnalyzeReading: true,
  showAnalysisDetails: false,
  
  // Notifications
  notifyBlindspots: true,
  notifyBreaking: false,
  notificationFrequency: 'daily',
  
  // Sources
  preferredSources: [] as number[],
  excludeUnknownSources: false,
})

const getBiasLabel = (bias: string | number) => {
  if (typeof bias === 'number') {
    switch (bias) {
      case 1: return 'Left'
      case 2: return 'Center'
      case 3: return 'Right'
      default: return 'Unknown'
    }
  }
  return bias?.charAt(0).toUpperCase() + bias?.slice(1) || 'Unknown'
}

const savePreferences = async () => {
  saving.value = true
  try {
    await updatePreferences(preferences.value)
    // Show success message
    console.log('Preferences saved successfully')
  } catch (error) {
    console.error('Failed to save preferences:', error)
  } finally {
    saving.value = false
  }
}

const resetToDefaults = () => {
  preferences.value = {
    showAllPerspectives: true,
    highlightBlindspots: true,
    showCoverageScores: true,
    biasSensitivity: 'medium',
    autoAnalyzeReading: true,
    showAnalysisDetails: false,
    notifyBlindspots: true,
    notifyBreaking: false,
    notificationFrequency: 'daily',
    preferredSources: [],
    excludeUnknownSources: false,
  }
}

const loadSources = async () => {
  try {
    const response = await get('/api/sources')
    availableSources.value = response.sources || []
  } catch (error) {
    console.error('Failed to load sources:', error)
  }
}

onMounted(() => {
  loadSources()
  
  // Load user's current preferences
  // This would typically come from the user's profile
  console.log('Loading user preferences...')
})
</script>

<style scoped>
.preferences-view {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.preferences-header {
  margin-bottom: 2rem;
}

.preferences-header h1 {
  font-size: 2rem;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.preferences-header p {
  color: #6b7280;
  font-size: 1.1rem;
}

.preferences-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.preference-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.preference-card h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1.5rem;
}

.preference-group {
  margin-bottom: 1.5rem;
}

.preference-group:last-child {
  margin-bottom: 0;
}

.preference-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
  cursor: pointer;
}

.preference-checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: #3b82f6;
}

.preference-description {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
  margin-left: 1.5rem;
}

.preference-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
  margin-bottom: 0.5rem;
}

.preference-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.source-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 1rem;
}

.source-checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.source-checkbox-label:hover {
  background: #f9fafb;
}

.source-name {
  flex: 1;
  font-weight: 500;
}

.source-bias {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.bias-left,
.bias-1 {
  background: #dbeafe;
  color: #1d4ed8;
}

.bias-center,
.bias-2 {
  background: #f3f4f6;
  color: #374151;
}

.bias-right,
.bias-3 {
  background: #fecaca;
  color: #dc2626;
}

.save-section {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 2rem;
  border-top: 1px solid #e5e7eb;
}

.save-button,
.reset-button {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.save-button {
  background: #3b82f6;
  color: white;
  border: none;
}

.save-button:hover:not(:disabled) {
  background: #2563eb;
}

.save-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reset-button {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.reset-button:hover {
  background: #f9fafb;
}

@media (max-width: 768px) {
  .preferences-view {
    padding: 1rem;
  }
  
  .save-section {
    flex-direction: column;
  }
}
</style>
