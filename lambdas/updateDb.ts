export async function handler(event: { Records: any[] }) {
  console.log('I am update database lambda');
  console.log(event);

  return {
    status: 200,
    body: JSON.stringify(event)
  };
}
