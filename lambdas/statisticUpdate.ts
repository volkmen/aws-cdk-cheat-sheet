exports.handler = function (event: { Records: any[] }) {
  console.log('I am statistic update lambda');

  return {
    status: 200,
    body: JSON.stringify(event)
  };
};
