# Mobile Pod Management Components

This directory contains mobile-optimized components for the Pod Management System.

## Components

### MobilePodManagementApp
- Main mobile application component
- Uses tab-based navigation (Search, Grid, Items)
- Responsive layout for all mobile devices including Galaxy Z Fold

### MobileHeader
- Compact header for mobile screens
- Responsive button layout

### MobileTabNavigation
- Bottom tab navigation
- Touch-friendly tab switching
- Disabled states for unavailable tabs

### MobileBinGrid
- Touch-optimized bin grid
- Larger touch targets (minimum 44px)
- Responsive grid layout

## Features

- **Touch-friendly**: All interactive elements meet 44px minimum touch target
- **Galaxy Z Fold support**: Optimized for both folded and unfolded states
- **Safe area support**: Handles device notches and rounded corners
- **Responsive breakpoints**: 
  - Mobile: < 1024px
  - Galaxy Z Fold outer: 316px
  - Galaxy Z Fold inner: 653px

## Usage

The mobile version is automatically activated when screen width < 1024px through the ResponsiveApp component.

## Mobile Optimizations

- Larger text and buttons
- Vertical button layouts where appropriate
- Touch-friendly spacing
- Optimized scrolling behavior
- Prevented zoom on input focus
- Safe area insets for modern devices