/**
 * API Configuration
 * Centralized configuration for all API endpoints
 */

// Get API base URL from environment variable, fallback to localhost
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Environment checks
export const IS_PRODUCTION = process.env.NODE_ENV === "production";
export const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

// Debug mode (can be enabled in production via environment variable)
export const DEBUG_ENABLED =
  process.env.REACT_APP_ENABLE_DEBUG === "true" || IS_DEVELOPMENT;

// Feature flags
export const FEATURES = {
  mobile: process.env.REACT_APP_ENABLE_MOBILE !== "false", // Default enabled
  debugMode: DEBUG_ENABLED,
};

// API Endpoints
export const API_ENDPOINTS = {
  // Base URL
  base: API_BASE_URL,

  // Pod endpoints
  pods: `${API_BASE_URL}/pods`,
  podByBarcode: (barcode) => `${API_BASE_URL}/pods/${barcode}`,
  podStatus: (barcode) => `${API_BASE_URL}/pods/${barcode}/status`,
  podFace: (barcode, faceId) =>
    `${API_BASE_URL}/pods/${barcode}/face/${faceId}`,
  podItems: (barcode) => `${API_BASE_URL}/pods/${barcode}/items`,
  podSummary: `${API_BASE_URL}/pods/summary`,

  // Cleaning endpoints
  cleans: `${API_BASE_URL}/cleans`,
  cleanById: (id) => `${API_BASE_URL}/cleans/${id}`,
  cleanStatus: (barcode) => `${API_BASE_URL}/cleans/${barcode}/status`,

  // Item endpoints
  items: `${API_BASE_URL}/items`,
  itemBySku: (sku) => `${API_BASE_URL}/items/${sku}`,
  itemStatus: (sku) => `${API_BASE_URL}/items/${sku}/status`,
  binItems: `${API_BASE_URL}/bin-items`,
  itemsByBin: (binId) => `${API_BASE_URL}/items/bin/${binId}`,
  bulkItemStatus: `${API_BASE_URL}/items/bulk-status`,

  // Bin-specific endpoints
  binItemsByLocation: (podBarcode, faceId, binId) =>
    `${API_BASE_URL}/pods/${podBarcode}/face/${faceId}/bin/${binId}/items`,

  // Health check
  health: `${API_BASE_URL}/health`,
};

// HTTP Request Helper
export const apiRequest = async (url, options = {}) => {
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);

    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP ${response.status}: ${errorText || response.statusText}`
      );
    }

    // Parse JSON response if content-type is JSON
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    }

    return await response.text();
  } catch (error) {
    // Log errors only in debug mode
    if (DEBUG_ENABLED) {
      console.error("API Request Error:", error);
    }
    throw error;
  }
};

// Export configuration
const config = {
  API_BASE_URL,
  API_ENDPOINTS,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  DEBUG_ENABLED,
  FEATURES,
  apiRequest,
};

export default config;
