export async function handler(event: { Records: any[] }) {
  return {
    status: 200,
    body: "Congrats I'm lambda"
  };
}
