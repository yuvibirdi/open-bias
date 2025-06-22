<template>
  <CDropdown variant="nav-item">
    <CDropdownToggle placement="bottom-end" class="py-0" :caret="false">
      <CAvatar
        src="/avatars/8.jpg"
        size="md"
        status="success"
      />
    </CDropdownToggle>
    <CDropdownMenu class="pt-0 pr-5 w-auto">
      <CDropdownHeader class="bg-light fw-semibold py-2">Account</CDropdownHeader>
      <CDropdownItem>
        <CIcon icon="cil-bell" class="me-2" />
        Updates
        <CBadge color="info" class="ms-2">42</CBadge>
      </CDropdownItem>
      <CDropdownItem>
        <CIcon icon="cil-envelope-open" class="me-2" />
        Messages
        <CBadge color="success" class="ms-2">42</CBadge>
      </CDropdownItem>
      <CDropdownItem>
        <CIcon icon="cil-task" class="me-2" />
        Tasks
        <CBadge color="danger" class="ms-2">42</CBadge>
      </CDropdownItem>
      <CDropdownItem>
        <CIcon icon="cil-comment-square" class="me-2" />
        Comments
        <CBadge color="warning" class="ms-2">42</CBadge>
      </CDropdownItem>
      <CDropdownHeader class="bg-light fw-semibold py-2">Settings</CDropdownHeader>
      <CDropdownItem>
        <CIcon icon="cil-user" class="me-2" />
        Profile
      </CDropdownItem>
      <CDropdownItem>
        <CIcon icon="cil-settings" class="me-2" />
        Settings
      </CDropdownItem>
      <CDropdownItem>
        <CIcon icon="cil-credit-card" class="me-2" />
        Payments
        <CBadge color="secondary" class="ms-2">42</CBadge>
      </CDropdownItem>
      <CDropdownItem>
        <CIcon icon="cil-file" class="me-2" />
        Projects
        <CBadge color="primary" class="ms-2">42</CBadge>
      </CDropdownItem>
      <CDropdownDivider />
      <CDropdownItem>
        <CIcon icon="cil-lock-locked" class="me-2" />
        Lock Account
      </CDropdownItem>
      <CDropdownItem>
        <CIcon icon="cil-account-logout" class="me-2" />
        Logout
      </CDropdownItem>
    </CDropdownMenu>
  </CDropdown>
</template>

<script setup>
// No script needed for this component
</script>
