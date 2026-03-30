import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email, action, reason, studentName } = await request.json();

    if (!email || !action) {
      return NextResponse.json(
        { error: "Email and action are required" },
        { status: 400 }
      );
    }

    // Here you would integrate with your email service
    // For now, we'll simulate the email sending
    let subject = "";
    let message = "";

    switch (action) {
      case "approved":
        subject = "Account Approved - SorSU Document Request System";
        message = `
Dear ${studentName},

Your account has been approved in the SorSU Document Request System.

You can now:
- Request documents such as Transcript of Records, Diploma, and Good Moral certificates
- Track the status of your requests in real-time
- Receive notifications when your documents are ready

${reason ? `Additional notes: ${reason}` : ""}

Best regards,
Sorsogon State University
Registrar's Office
        `;
        break;

      case "declined":
        subject = "Account Declined - SorSU Document Request System";
        message = `
Dear ${studentName},

Your account registration has been declined.

${reason ? `Reason: ${reason}` : "Please contact the registrar's office for more information."}

If you believe this is an error, please visit the registrar's office with your valid ID.

Best regards,
Sorsogon State University
Registrar's Office
        `;
        break;

      case "banned":
        subject = "Account Suspended - SorSU Document Request System";
        message = `
Dear ${studentName},

Your account has been suspended due to policy violations.

${reason ? `Reason: ${reason}` : "Please contact the registrar's office for more information."}

If you wish to appeal this decision, please visit the registrar's office.

Best regards,
Sorsogon State University
Registrar's Office
        `;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    // Log the email for development (in production, use actual email service)
    console.log("=== EMAIL NOTIFICATION ===");
    console.log("To:", email);
    console.log("Subject:", subject);
    console.log("Message:", message);
    console.log("========================");

    // TODO: Integrate with actual email service
    // Examples: SendGrid, Nodemailer, Resend, etc.
    /*
    const emailResponse = await emailService.send({
      to: email,
      subject: subject,
      text: message,
      html: message.replace(/\n/g, '<br>')
    });
    */

    return NextResponse.json(
      { 
        success: true, 
        message: "Email notification sent successfully",
        email: email,
        action: action
      }
    );

  } catch (error) {
    console.error("Error sending registrar email:", error);
    return NextResponse.json(
      { error: "Failed to send email notification" },
      { status: 500 }
    );
  }
}
