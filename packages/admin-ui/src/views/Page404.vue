<template>
  <div class="bg-light min-vh-100 d-flex flex-row align-items-center">
    <CContainer>
      <CRow class="justify-content-center">
        <CCol :md="6">
          <div class="clearfix">
            <h1 class="float-start display-3 me-4">404</h1>
            <h4 class="pt-3">Oops! You're lost.</h4>
            <p class="text-muted float-start">
              The page you are looking for was not found.
            </p>
          </div>
          <CInputGroup class="input-prepend">
            <CInputGroupText>
              <CIcon icon="cil-magnifying-glass" />
            </CInputGroupText>
            <CFormInput placeholder="What are you looking for?" />
            <CButton color="info">Search</CButton>
          </CInputGroup>
        </CCol>
      </CRow>
    </CContainer>
  </div>
</template>

<script setup>
// No script needed for this component
</script>
