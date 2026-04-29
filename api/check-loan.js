export default async function handler(req, res) {
    const { phone, pin } = req.query;

    // --- ЭНД ӨӨРИЙН GOOGLE DRIVE FILE ID-НУУДАА ОРУУЛААРАЙ ---
    const USERS_FILE_ID = '1XgS_6oukQvuoG1gL7w5OxTrNlxXbg11w';
    const CONFIG_FILE_ID = '1hcS_8-8qDv5w_-4wPG0RGk0IZH8mlijw';
    const SERVICES_FILE_ID = '10qCz9BvefhEvzXQsqarkFTgIG7YWy82m';

    const getGDriveUrl = (id) => `https://docs.google.com/uc?export=download&id=${id}`;

    try {
        // 1. users.txt файлыг уншиж нэвтрэх эрх шалгах
        const usersRes = await fetch(getGDriveUrl(USERS_FILE_ID));
        const usersText = await usersRes.text();
        const userLines = usersText.split('\n');
        
        const isValidUser = userLines.some(line => {
            const [uPhone, uPin] = line.trim().split('|');
            return uPhone === phone && uPin === pin;
        });

        if (!isValidUser) {
            return res.status(401).json({ success: false, message: "Утас эсвэл нууц код буруу!" });
        }

        // 2. system_config.dat (Зээлийн мэдээлэл) унших
        const configRes = await fetch(getGDriveUrl(CONFIG_FILE_ID));
        const configText = await configRes.text();
        const configLines = configText.split('\n');

        // 3. app_services.dat (Сунгалтын мэдээлэл) унших
        const servicesRes = await fetch(getGDriveUrl(SERVICES_FILE_ID));
        const servicesText = await servicesRes.text();
        const servicesLines = servicesText.split('\n');

        // 4. Тухайн хэрэглэгчийн зээлийг хайх (Утасны дугаараар)
        const loanLine = configLines.find(line => {
            const parts = line.split('|');
            return parts[3] === phone; // Индекс 3 нь утасны дугаар
        });

        if (!loanLine) {
            return res.status(404).json({ success: false, message: "Таны нэр дээр идэвхтэй зээл олдсонгүй." });
        }

        const parts = loanLine.split('|');
        const amount = parseFloat(parts[4]) || 0;
        const putDateStr = parts[8];
        const extDateStr = parts[16]; // Сунгалтын огноо

        // Сунгалтын тэмдэглэлээс хасалтуудыг (Discount) тооцох
        let totalDiscount = 0;
        servicesLines.forEach(line => {
            const sParts = line.split('|');
            if (sParts[0] === parts[0] && sParts[1] === parts[1] && sParts[2] === parts[2]) {
                totalDiscount += parseFloat(sParts[9]) || 0; // Индекс 9 нь хасалт
            }
        });

        const remainingPrincipal = amount - totalDiscount;
        const startDate = new Date(extDateStr || putDateStr);
        const today = new Date();

        const diffTime = Math.abs(today - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Хүү тооцоолох (0.14%)
        const interest = Math.round(remainingPrincipal * 0.0014 * diffDays);
        
        // Торгууль тооцоолох (30 хоногоос хэтэрвэл 20%)
        let penalty = 0;
        if (diffDays > 30) {
            penalty = Math.round(interest * 0.2);
        }

        const totalInterest = (parseFloat(parts[18]) > 0) ? parseFloat(parts[18]) : (interest + penalty);

        return res.status(200).json({
            success: true,
            loan: {
                no: parts[1],
                name: parts[2],
                amount: remainingPrincipal,
                date: putDateStr,
                days: diffDays,
                interest: interest,
                penalty: penalty,
                totalInterest: totalInterest
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Серверийн алдаа гарлаа." });
    }
}
