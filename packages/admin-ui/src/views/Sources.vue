<template>
  <CContainer fluid>
    <CRow>
      <CCol :xs="12">
        <CCard class="mb-4">
          <CCardHeader>
            <strong>Sources Management</strong>
          </CCardHeader>
          <CCardBody>
            <p>Manage RSS news sources</p>
            
            <!-- Add Source Button -->
            <CRow class="mb-3">
              <CCol>
                <CButton color="primary" @click="showAddModal = true">
                  Add New Source
                </CButton>
              </CCol>
            </CRow>

            <!-- Sources Table -->
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Name</CTableHeaderCell>
                  <CTableHeaderCell>RSS URL</CTableHeaderCell>
                  <CTableHeaderCell>Bias</CTableHeaderCell>
                  <CTableHeaderCell>Actions</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                <CTableRow v-for="source in sources" :key="source.id">
                  <CTableDataCell>{{ source.name }}</CTableDataCell>
                  <CTableDataCell>
                    <a :href="source.rss" target="_blank" class="text-decoration-none">
                      {{ source.rss }}
                    </a>
                  </CTableDataCell>
                  <CTableDataCell>
                    <CBadge :color="source.bias === 1 ? 'primary' : source.bias === 3 ? 'danger' : 'success'">
                      {{ source.bias === 1 ? 'Left' : source.bias === 3 ? 'Right' : 'Center' }}
                    </CBadge>
                  </CTableDataCell>
                  <CTableDataCell>
                    <CButton color="danger" size="sm" @click="deleteSource(source.id)">
                      Delete
                    </CButton>
                  </CTableDataCell>
                </CTableRow>
              </CTableBody>
            </CTable>

            <!-- Loading/Empty states -->
            <div v-if="loading" class="text-center p-4">
              <CSpinner />
              <p class="mt-2">Loading sources...</p>
            </div>
            
            <div v-else-if="sources.length === 0" class="text-center p-4">
              <p>No sources found.</p>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>

    <!-- Add Source Modal -->
    <CModal :visible="showAddModal" @close="showAddModal = false">
      <CModalHeader>
        <CModalTitle>Add New Source</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CForm>
          <CRow class="mb-3">
            <CCol>
              <CFormLabel>Source Name</CFormLabel>
              <CFormInput v-model="newSource.name" placeholder="Enter source name" />
            </CCol>
          </CRow>
          <CRow class="mb-3">
            <CCol>
              <CFormLabel>RSS Feed URL</CFormLabel>
              <CFormInput v-model="newSource.rss" placeholder="https://example.com/feed" />
            </CCol>
          </CRow>
        </CForm>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" @click="showAddModal = false">Cancel</CButton>
        <CButton color="primary" @click="addSource">Add Source</CButton>
      </CModalFooter>
    </CModal>
  </CContainer>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getSources } from '../composables/useApi'
import type { Source } from '../composables/useApi'

const sources = ref<Source[]>([])
const loading = ref(false)
const error = ref('')
const showAddModal = ref(false)
const newSource = ref({
  name: '',
  rss: '',
})

const loadSources = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await getSources()
    sources.value = response.sources || []
    console.log('Loaded sources:', sources.value.length)
  } catch (err) {
    console.error('Failed to load sources:', err)
    error.value = 'Failed to load sources from API'
    // Fallback to mock data
    sources.value = [
      {
        id: 1,
        name: "Sample News",
        rss: "https://samplenews.com/feed",
        bias: 1
      },
      {
        id: 2,
        name: "Another News",
        rss: "https://anothernews.com/feed", 
        bias: 2
      },
    ]
  } finally {
    loading.value = false
  }
}

const addSource = async () => {
  if (!newSource.value.name || !newSource.value.rss) {
    alert('Please fill in all fields')
    return
  }

  try {
    // Mock add - would call API in real implementation
    const id = Math.max(0, ...sources.value.map(s => s.id)) + 1
    sources.value.push({
      id,
      name: newSource.value.name,
      rss: newSource.value.rss,
      bias: 2 // Default to center
    })
    
    // Reset form
    newSource.value = { name: '', rss: '' }
    showAddModal.value = false
    
    console.log('Source added successfully')
  } catch (error) {
    console.error('Failed to add source:', error)
  }
}

const deleteSource = async (id: number) => {
  if (!confirm('Are you sure you want to delete this source?')) return
  
  try {
    // Mock delete
    sources.value = sources.value.filter(s => s.id !== id)
    console.log(`Deleted source ${id}`)
  } catch (error) {
    console.error('Failed to delete source:', error)
  }
}

onMounted(async () => {
  await loadSources()
})
</script>