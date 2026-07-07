// Belt-and-braces asset forwarder: if a service-binding fetch reaches the
// script instead of the asset layer, serve the asset explicitly.
export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
