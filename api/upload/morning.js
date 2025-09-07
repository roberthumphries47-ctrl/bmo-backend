// Alias endpoint for Morning Upload
export { default } from "../digest/morning.js";
return res.status(200).json({
  day,
  appointments,
  tasks,
  bills,
  subscriptionsNext30,
  dueSoon14,
  // themed key
  uploadMessage: msg,
  // stable universal key
  message: msg
});
