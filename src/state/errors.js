import { createSlice } from "@reduxjs/toolkit";

export const errorSlice = createSlice({
  name: "errors",
  initialState: [],
  reducers: {
    setErrors: (state, { payload }) => {
      return payload || [];
    },
  },
});

export const { setErrors } = errorSlice.actions;

export default errorSlice.reducer;
