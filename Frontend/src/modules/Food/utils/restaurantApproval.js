export const extractRestaurantFromResponse = (response) =>
  response?.data?.data?.restaurant ||
  response?.data?.restaurant ||
  response?.data?.data?.user ||
  response?.data?.user ||
  null

export const isRestaurantApproved = (restaurant) => {
  const status = String(restaurant?.status || "").toLowerCase()
  if (status === "approved") return true
  return restaurant?.isActive === true && status !== "pending" && status !== "rejected"
}

export const persistRestaurantAuthFromPayload = (payload, setAuthData) => {
  const accessToken = payload?.accessToken
  const refreshToken = payload?.refreshToken ?? null
  const restaurant = payload?.restaurant || payload?.user
  if (!accessToken || !restaurant) return false

  setAuthData("restaurant", accessToken, restaurant, refreshToken)
  window.dispatchEvent(new Event("restaurantAuthChanged"))
  return true
}
